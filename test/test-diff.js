'use strict'

const test = require('tape')
const diff = require('..')

test('same empty element', t => {
  t.plan(1)
  const t0 = ['div', {}]
  const t1 = ['div', {}]
  t.deepEqual(diff.diff(t0, t1),
              []
             )
})

test('different empty element', t => {
  t.plan(1)
  const t0 = ['div', {}]
  const t1 = ['span', {}]
  try {
    diff.diff(t0, t1)
  } catch (e) {
    t.equal(e, 'You can\'t patch when the roots are different types')
  }
})

test('remove the one child', t => {
  t.plan(1)
  const t0 = ['div', {}, 'hello']
  const t1 = ['div', {}]
  t.deepEqual(diff.diff(t0, t1),
              [
                { method: 'remove',
                  object: 1 }
              ]
             )
})

test('add the one child', t => {
  t.plan(1)
  const t0 = ['div', {}]
  const t1 = ['div', {}, 'hello']
  t.deepEqual(diff.diff(t0, t1),
              [ { child: 'hello', method: 'appendChild', parent: 0 } ]
             )
})

test('replace the one child', t => {
  t.plan(1)
  const t0 = ['div', {}, 'a']
  const t1 = ['div', {}, 'b']
  t.deepEqual(diff.diff(t0, t1),
              [
                { method: 'remove', object: 1 },
                { child: 'b', method: 'appendChild', parent: 0 } ]
             )
})

test('keep one child the same', t => {
  t.plan(1)
  const t0 = ['div', {}, 'a']
  const t1 = ['div', {}, 'a']
  t.deepEqual(diff.diff(t0, t1),
              [
              ]
             )
})

test('several children, the same', t => {
  t.plan(1)
  const t0 = ['div', {}, 'a', 'b', 'c', 'd', 'e']
  const t1 = ['div', {}, 'a', 'b', 'c', 'd', 'e']
  t.deepEqual(diff.diff(t0, t1),
              [
                ]
             )
})

test('several children, one append', t => {
  t.plan(1)
  const t0 = ['div', {}, 'a', 'b', 'c', 'd', 'e']
  const t1 = ['div', {}, 'a', 'b', 'c', 'd', 'e', 'f']
  t.deepEqual(diff.diff(t0, t1),
              [
                { child: 'f', method: 'appendChild', parent: 0 }

              ]
             )
})


test('several children, one insert in middle', t => {
  t.plan(1)
  const t0 = ['div', {}, 'a', 'b', 'c', 'd', 'e']
  const t1 = ['div', {}, 'a', 'b', 'c', 'cc', 'd', 'e']
  t.deepEqual(diff.diff(t0, t1),
              [
                { inserted: 'cc', method: 'insertBefore', sibling: 4 }
              ]
             )
})

test('several children, one insert at start', t => {
  t.plan(1)
  const t0 = ['div', {}, 'a', 'b', 'c', 'd', 'e']
  const t1 = ['div', {}, '9', 'a', 'b', 'c', 'd', 'e']
  t.deepEqual(diff.diff(t0, t1),
              [
                { inserted: '9', method: 'insertBefore', sibling: 1 }
              ]
             )
})

test('a level down', t => {
  t.plan(1)
  const t0 = ['div', {}, ['span', {}, 'a', 'b', 'c', 'd', 'e']]
  const t1 = ['div', {}, 'a', 'b']
  t.deepEqual(diff.diff(t0, t1),
              [
                { method: 'remove', object: 1 },
                { child: 'a', method: 'appendChild', parent: 0 },
                { child: 'b', method: 'appendChild', parent: 0 }
              ]
             )
})

test('a level down complex', t => {
  t.plan(1)
  const t0 = ['div', {}, ['span', {}, 'a', 'b', 'c', 'd', 'e']]
  const t1 = ['div', {}, ['span', {}, '9', 'a', 'b', 'c', 'cc', 'd', 'e', 'f']]
  t.deepEqual(diff.diff(t0, t1),
              [
                { inserted: '9', method: 'insertBefore', sibling: 2 },
                { inserted: 'cc', method: 'insertBefore', sibling: 5 },
                { child: 'f', method: 'appendChild', parent: 1 } 
              ]
             )
})

test('attributes', t => {
  t.plan(1)
  const t0 = ['div', {}, ['span', { a: 1, '$b': 2}, 'a', 'b', 'c']]
  const t1 = ['div', {}, ['span', { a: 5, c: 'x'}, 'a', 'B', 'b']]
  t.deepEqual(diff.diff(t0, t1), [
    { attribute: 'a', method: 'setAttribute', object: 1, value: 5 },
    { attribute: 'c', method: 'setAttribute', object: 1, value: 'x' },
    { attribute: '$b', method: 'deleteAttribute', object: 1 },
    { inserted: 'B', method: 'insertBefore', sibling: 3 },
    { method: 'remove', object: 4 } 
  ])
})

test('Text more than one char long', t => {
  t.plan(1)
  const t0 = ['div', {}, 'Hello', ', world!']
  const t1 = ['div', {}, 'Hello', ', World!']
  t.deepEqual(diff.diff(t0, t1), [
    { method: 'remove', object: 2 },   
    { child: ', World!', method: 'appendChild', parent: 0 } 
  ])
})

test('10000 entries', t => {
  t.plan(1)
  const t0 = ['div', {}, 'Hello', ', World!']
  const t1 = ['div', {}]
  for (let x = 0; x < 10000; x++) {
    t1.push(['span', {}, 'whatever'])
  }
  const d = diff.diff(t0, t1)
  t.deepEqual(d.length, 10002)
})


test('replace the last child, with nested element', t => {
  t.plan(1)
  const t0 = ['div', {}, 'a', ['span', {}, 'b'], 'c', 'd']
  const t1 = ['div', {}, 'a', ['span', {}, 'b'], 'c', 'D']
  t.deepEqual(diff.diff(t0, t1),
              [
                { method: 'remove', object: 5 },
                { child: 'D', method: 'appendChild', parent: 0 }
              ]
             )
})


test('replace the last child, with nested element', t => {
  // this was an actually bug, discovered when running in browser
  t.plan(1)
  const t0 = ["div",{},"Hello",", World!",["span",{"id":"x","$color":"red"}," Again"," today"]," starting slow thing....","_","_","_","_","_"]
  const t1 = ["div",{},"Hello",", World!",["span",{"id":"x","$color":"red"}," Again"," today"]," starting slow thing....","_","_","_","_","[replacement 1]"]
  t.deepEqual(diff.diff(t0, t1),
              [
                { attribute: '$color', method: 'setAttribute', object: 3, value: 'red' },
                { attribute: 'id', method: 'setAttribute', object: 3, value: 'x' },
                { method: 'remove', object: 11 },
                { child: '[replacement 1]', method: 'appendChild', parent: 0 } 
              ]
             )
})

