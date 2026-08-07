import * as obj from './macros/nested-object.ts' with { type: 'macro' }

obj.foo.a.b.c.d() === 'foo'
