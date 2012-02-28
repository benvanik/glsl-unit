// Copyright 2011 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/**
 * @fileoverview Test cases for GLSL parser grammer generated by glsl.pegjs.
 * @author rowillia@google.com (Roy Williams)
 */
goog.require('glslunit.Generator');
goog.require('glslunit.glsl.parser');
goog.require('goog.array');

function setUp() {
  parser = glslunit.glsl.parser;
}

function roundTripTest(testSource, startRule) {
  assertEquals(testSource,
               glslunit.Generator.getSourceCode(parser.parse(testSource,
                                                             startRule)));
}

function throwsExceptionTest(testSource, failMessage, shaderType) {
  var threwException = false;
  try {
    parser.parse(testSource, shaderType);
  } catch (e) {
    threwException = true;
  }
  assertEquals(failMessage, true, threwException);
}

function testEmptyFunction() {
  roundTripTest('void main(){}');
}

function testPreprocessor() {
  var directives = ['define', 'undef', 'pragma', 'version', 'error',
                    'extension', 'line'];
  goog.array.forEach(directives, function(directive) {
                       var testSource = '#' + directive + ' something';
                       assertEquals(testSource + '\n',
                                    glslunit.Generator.getSourceCode(
                                        parser.parse(testSource)));
                     });
  directives = ['ifdef', 'ifndef', 'if'];
  goog.array.forEach(directives, function(directive) {
                       var testSource = '#' + directive + ' FOO\n' +
                                       'void main(){}\n' +
                                       '#elif BAR\n' +
                                       'void barMain(){}\n' +
                                       '#else\n' +
                                       'void elseMain(){}\n' +
                                       '#endif';
                       assertEquals(testSource + '\n',
                                    glslunit.Generator.getSourceCode(
                                        parser.parse(testSource)));
                    });
  var testSource = '#define FOO\n' +
                   'void main(){}\n' +
                   '#endif';
  throwsExceptionTest(testSource,
                     'Parser should throw exception on #endif without an #if');
  testSource = '#ifdef FOO\n' +
               'void main(){}\n';
  throwsExceptionTest(testSource,
                      'Parser should throw exception on #ifdef without #endif');
}

function testAttributeDeclaration() {
  roundTripTest('attribute vec2 something;', 'vertex_start');
  roundTripTest('attribute vec3 something,somethingElse;', 'vertex_start');
  throwsExceptionTest('attribute vec2 something;',
                      'Parser should throw exception when parsing attribute ' +
                        'in a fragment shader',
                      'fragment_start');
  throwsExceptionTest('attribute float something = 11.1;',
                      'Should not be able to initalize attributes',
                      'vertex_start');
  throwsExceptionTest('attribute float problems[99];',
                      'Should not be able to declare attribute arrays',
                      'vertex_start');
}

function testFullySpecifiedType() {
  var typeQualifiers = ['', 'const ', 'varying ',
                        'invariant varying ', 'uniform '];
  goog.array.forEach(typeQualifiers, function(typeQualifier) {

    roundTripTest(typeQualifier + 'highp vec4 something;');
    roundTripTest(typeQualifier + 'mat2 something,somethingElse[12];');
  });
  throwsExceptionTest('void main(){varying float not_me;}',
                      'Local types should not be able to have qualifiers');
}

function testFunctionPrototype() {
  roundTripTest('void func();');
  roundTripTest('highp mat3 func();');
  roundTripTest('float func(mat4 a,bool b);');
  roundTripTest('void func(in sampler2D a,inout highp float b);');
  roundTripTest('float func(const in samplerCube a[12]);');
  throwsExceptionTest('void func(const out float a);',
                      'Only in arguments can be declared const');
  throwsExceptionTest('void func(varying out float a);',
                      'Function Parameters can\'t have qualifiers');
}

function testLocallySpecifiedType() {
  roundTripTest('void main(){int x;}');
  roundTripTest('void main(){int x[1];}');
  roundTripTest('void main(){const highp int x[],y;}');
  throwsExceptionTest('void main(){void x;}',
                      'Types can\'t be declared as void');
  throwsExceptionTest('void main(){int lowp;}',
                      'Variables can\'t have reserved names');
}

function testStruct() {
  roundTripTest('struct{int x;};');
  roundTripTest('varying struct{int x[1],y;};');
  roundTripTest('struct s{int x;highp float y;};');
  roundTripTest('struct s{int x;}z;');
  roundTripTest('struct s{int x;}z;struct s2{s y;}q;');
  throwsExceptionTest('struct{int x[];};',
                      'Arrays in structs must have a size');
  throwsExceptionTest('struct{int x;struct {int y;}a;};',
                      'Structs can\'t be embedded in structs');
}

function testIntConstant() {
  var testSource = 'int x=128;';
  roundTripTest(testSource);
  assertEquals(testSource,
               glslunit.Generator.getSourceCode(parser.parse('int x=0x80;')));
  assertEquals(testSource,
               glslunit.Generator.getSourceCode(parser.parse('int x=0200;')));
  roundTripTest('int x=0;');
}

function testFloatConstant() {
  roundTripTest('float x=12.8;');
  roundTripTest('float x=1.28e23;');
  roundTripTest('float x=1.28e-23;');
  roundTripTest('float x=1e23;');
}

function testBoolConstant() {
  roundTripTest('bool b=false;');
  roundTripTest('bool b=true;');
}

function testPostfix() {
  roundTripTest('x[1]', 'condition');
  roundTripTest('x.xyz', 'condition');
  roundTripTest('x[1].xyz[1]', 'condition');
  roundTripTest('x++', 'condition');
  assertEquals('x++',
    glslunit.Generator.getSourceCode(parser.parse('x ++',
                                                  'condition')));
  roundTripTest('x--', 'condition');
  roundTripTest('x[1].xyz[1]++', 'condition');
  roundTripTest('x[1]++.rgba', 'condition');
  throwsExceptionTest('x++++', '++/-- can\'t repeat', 'condition');
  throwsExceptionTest('x++--', '++/-- can\'t repeat', 'condition');
}

function testUnary() {
  var expressions = ['-', '+', '++', '--', '!', '~'];
  goog.array.forEach(expressions, function(expression) {
    var testCode = expression + 'x';
    roundTripTest(testCode, 'condition');
    var node = parser.parse(testCode, 'condition');
    assertEquals('unary', node.type);
    // Check to make sure we parsed properly.  This checks that --/++ get parsed
    // properly instead of as two separate +'s or -'s
    assertEquals(expression, node.operator.operator);
    assertEquals('identifier', node.expression.type);
  });
}

function testBinary() {
  var operators = ['*', '/', '%', '+', '-', '<<', '>>', '<', '>', '<=', '==',
                   '>=', '!=', '&', '^', '|', '&&', '||'];
  goog.array.forEach(operators, function(operator) {
    var testCode = 'x' + operator + 'y';
    roundTripTest(testCode, 'condition');
    var node = parser.parse(testCode, 'condition');
    assertEquals('binary', node.type);
    assertEquals(operator, node.operator.operator);
    assertEquals('x', node.left.name);
    assertEquals('y', node.right.name);
  });
  roundTripTest('(x+y)*9', 'condition');
}

function testFunctionCall() {
  roundTripTest('void main(){func(a,b,c);}');
}

function testWhiteSpaceFunction() {
  var testSource = '\n' +
    'precision highp float;\n' +
    'attribute vec4 aOutput;\n' +
    'float someFunc(void);\n' +
    '\n' +
    'void main(void) {\n' +
    '  gl_Position = someFunc() * vec4(1.,2.,3.,4.);\n' +
    '}\n' +
    'float someFunc(void) {\n' +
    '  return 42.0;\n' +
    '}';
  var goldenSource =
    'precision highp float;' +
    'attribute vec4 aOutput;' +
    'float someFunc();' +
    'void main(){' +
    'gl_Position=someFunc()*vec4(1.,2.,3.,4.);' +
    '}' +
    'float someFunc(){' +
    'return 42.;' +
    '}';
  assertEquals(goldenSource,
               glslunit.Generator.getSourceCode(parser.parse(testSource)));
}
