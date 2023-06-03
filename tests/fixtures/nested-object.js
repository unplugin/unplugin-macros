import * as obj from './macros/nested-object' assert { type: 'macro' }

obj.foo.a.b.c.d() === 'foo'
