import * as obj from './macros/nested-object' with { type: 'macro' }

obj.foo.a.b.c.d() === 'foo'
