'use strict'

const test = require('tape')
const fs = require('fs')
const diff = require('..')
const jsdom = require("jsdom").jsdom

test('simple example from jsdom docs', t => {
  t.plan(1)
  const document = jsdom("hello world");
  const window = document.defaultView;
  const html = window.document.documentElement.outerHTML
  t.equal(html,
          '<html><head></head><body>hello world</body></html>')
})

test('manipulate the dom from outside document', t => {
  t.plan(1)
  const document = jsdom("hello world");

  const e = document.createElement('i')
  document.body.appendChild(e)

  const body = document.body.innerHTML
  t.equal(body,
          'hello world<i></i>')
})

test('real css', t => {
  t.plan(1)
  const document = jsdom('');
  const div = document.createElement('div')
  document.body.appendChild(div)
  
  const t0 = ['div']
  const t1 = ['div', {
    $width: '500px',
    $backgroundColor: 'white',
    $margin: '2px 8px 8px 305px',
    $border: '12px solid white',
    $color: 'rgb(144, 148, 156)',
    $fontFamily: 'helvetica,arial,sans-serif',
    $fontSize: '14px',
    $lineHeight: '1.5em'
  }, 'Hello, World!']
  
  const patch = diff.diff(t0, t1)

  diff.patch(div, patch, document)

  const html = document.documentElement.outerHTML
  t.equal(html,
          '<html><head></head><body><div style="background-color: white; border: 12px solid white; color: rgb(144, 148, 156); font-family: helvetica,arial,sans-serif; font-size: 14px; line-height: 1.5em; margin: 2px 8px 8px 305px; width: 500px;">Hello, World!</div></body></html>')
})


test.skip('hard deltas 1', t => {
  t.plan(1)
  const document = jsdom('');
  const div = document.createElement('div')
  document.body.appendChild(div)

  const deltas = require('./hard-deltas-1.json')

  let count = 0
  for (let patch of deltas) {
    count++
    diff.patch(div, patch, document)
    save(document, 'save-'+count+'.html')
  }
  
  // diff.patch(div, deltas[0], document)
  // diff.patch(div, deltas[1], document)

  const html = document.documentElement.outerHTML
  // t.equal(html,
  // '<html><head></head><body><div><div><div>Search:<input id="search" placeholder="mit.edu" size="30" type="text"><br><button style="margin: 1.5em;">Submit</button></div><div></div></div></div></body></html>')
})

test('replay 1', t => {
  t.plan(1)
  const document = jsdom('');
  const div = document.createElement('div')
  document.body.appendChild(div)

  const seq = [
    /*
    ['div', {}, ['span', {}, 'hello']],
    ['div', {}, 'hello'],
    ['div', {a: 1}, 'hello', 'bye'],
    ['div', {a: 1}, 'hello', ['b', 3] , 'bye'],
    ['div', {a: 1}, 'hello', ['b', {a:1, $height: '3px'}, 3] , 'bye'],
    */

    //  0        1         2     3      4         5        6    7     8
    ['div', {}, ['a', {}, 'a1', 'a2', ['aa', {}, 'aa1']] , 'b', 'c', 'd'],
    // ['div', {}, ['a', {}, 'a1', 'a2', ['aa', {}, 'aa1']] , 'b', 'd'],
    ['div', {}, 'b', 'd',],


    ['div', {}, ['a', {}, 'a1'] , 'b'],
    
    // ['div', {}, ['a', {}] , 'b'],     works, callinf a1 obj 2, with this
    // ['div', {}, ['a', {}, 'a1']],     works, calling 'b' obj 3, with this
    //   ... it's like there's renumbering happing before we get to b
    ['div', {}]
  ]

  let prev = ['div', {}]
  for (let snap of seq) {
    //console.log('diffing', prev, snap)
    const delta = diff.diff(prev, snap)
    //console.log('delta:', delta)
    diff.patch(div, delta, document)
    prev = snap
  }
  const html = document.documentElement.outerHTML
  t.equal(html,'<html><head></head><body><div></div></body></html>')

})

function save (document, filename) {
  const html = document.documentElement.outerHTML
  fs.writeFileSync(filename, html)
}
