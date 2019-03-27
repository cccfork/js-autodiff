var uglify = require("uglify-js"),
		jsp = uglify.parser,
		pro = uglify.uglify,
		vm = require('vm');

function Dual(v, g) {
	return {v: v, g: g || 0};
}

var AD = {
	neg: function(x) {
		return Dual(-x.v, -x.g);
	},
	incr: function(x) {
		++x.v;
	},
	decr: function(x) {
		--x.v;
	},
	gt: function(x, y) {
		return x.v > y.v;
	},
	gte: function(x, y) {
		return x.v >= y.v;
	},
	lt: function(x, y) {
		return x.v < y.v;
	},
	lte: function(x, y) {
		return x.v <= y.v;
	},
	eq: function(x, y) {
		return x.v == y.v;
	},
	add: function(x, y) {
		return Dual(x.v + y.v, x.g + y.g);
	},
	sub: function(x, y) {
		return Dual(x.v - y.v, x.g - y.g);
	},
	mul: function(x, y) {
		return Dual(x.v * y.v, x.v * y.g + y.v * x.g);
	},
	div: function(x, y) {
		return Dual(x.v / y.v, (y.v * x.g - x.v * y.g) / (y.v * y.v));
	},
	addAssign: function(x, y) {
		var sum = AD.add(x, y);
		x.v = sum.v;
		x.g = sum.g;
	},
	subAssign: function(x, y) {
		var diff = AD.sub(x, y);
		x.v = diff.v;
		x.g = diff.g;
	},
	mulAssign: function(x, y) {
		var prod = AD.mul(x, y);
		x.v = prod.v;
		x.g = prod.g;
	},
	divAssign: function(x, y) {
		var quot = AD.div(x, y);
		x.v = quot.v;
		x.g = quot.g;
	},
	sqrt: function(x) {
		return Dual(Math.sqrt(x.v), x.g * 0.5 / Math.sqrt(x.v));
	},
	sin: function(x) {
		return Dual(Math.sin(x.v), x.g * Math.cos(x.v));
	},
	cos: function(x) {
		return Dual(Math.cos(x.v), -x.g * Math.sin(x.v));
	},
	tan: function(x) {
		return Dual(Math.tan(x.v), x.g / (Math.cos(x.v) * Math.cos(x.v)));
	},
	asin: function(x) {
		return Dual(Math.asin(x.v), x.g / Math.sqrt(1 - x.v * x.v));
	},
	acos: function(x) {
		return Dual(Math.acos(x.v), -x.g / Math.sqrt(1 - x.v * x.v));
	},
	atan: function(x) {
		return Dual(Math.atan(x.v), x.g / (1 + x.v * x.v));
	},
	log: function(x) {
		return Dual(Math.log(x.v), x.g / x.v);
	},
	exp: function(x) {
		return Dual(Math.exp(x.v), x.g * Math.exp(x.v));
	},
	abs: function(x) {
		var g;
		if (x.v > 0) {
			g = 1;
		} else if (x.v < 0) {
			g = -1;
		} else {
			g = NaN;
		}
		return Dual(Math.abs(x.v), x.g * g);
	},
	PI: Dual(Math.PI),
	E: Dual(Math.E),
	LOG2E: Dual(Math.LOG2E),
	LN2: Dual(Math.LN2),
	LN10: Dual(Math.LN10),
	LOG10E: Dual(Math.LOG10E),
	SQRT2: Dual(Math.SQRT2),
	SQRT1_2: Dual(Math.SQRT1_2)
}


function transform(ast) {
	var w = pro.ast_walker(), walk = w.walk, scope;
	var binOpMap = {
		'+': 'add',
		'-': 'sub',
		'*': 'mul',
		'/': 'div',
		'<': 'lt',
		'<=': 'lte',
		'>': 'gt',
		'>=': 'gte',
		'==': 'eq',
		'===': 'eq'
	};
	var unOpMap = {
		'-': 'neg',
		'--': 'decr',
		'++': 'incr'
	};
	var assignOpMap = {
		'+': 'addAssign',
		'-': 'subAssign',
		'*': 'mulAssign',
		'/': 'divAssign'
	};
	return w.with_walkers({
		'num': function(num) {
			return ['call', ['name', 'Dual'], [['num', num]]];
		},
		'unary-prefix': function(op, expr) {
			if (unOpMap[op]) {
				return ['call', ['dot', ['name', 'AD'], unOpMap[op]], [walk(expr)]];
			}
      return [this[0], op, walk(expr)];
		},
		'unary-postfix': function(op, expr) {
			if (unOpMap[op]) {
				return ['call', ['dot', ['name', 'AD'], unOpMap[op]], [walk(expr)]];
			}
      return [this[0], op, walk(expr)];
		},
		'binary': function(op, left, right) {
			if (binOpMap[op]) {
				return ['call', ['dot', ['name', 'AD'], binOpMap[op]], [walk(left), walk(right)]];
			}
	    return [ this[0], op, walk(left), walk(right) ];
		},
    'assign': function(op, lvalue, rvalue) {
			if (assignOpMap[op]) {
				return ['call', ['dot', ['name', 'AD'], assignOpMap[op]], [walk(lvalue), walk(rvalue)]];
			}
			return [ this[0], op, walk(lvalue), walk(rvalue) ];
    },
		'name': function(name) {
			if (name === 'Math') {
				return [this[0], 'AD'];
			}
		  return [this[0], name];
		},
	}, function() {
		return walk(pro.ast_add_scope(ast));
	});
}

function diff(f, at) {
	var ast = jsp.parse('(' + f.toString() + ')');
	var transformed = transform(ast);
	var generated = pro.gen_code(transformed);
	var context = vm.createContext({
		AD: AD,
		at: Dual(at, 1),
		Dual: Dual,
		console: console,
	});
	vm.runInContext('result = ('+generated+')(at)', context);
	return context.result.g;
}

exports.diff = diff;

