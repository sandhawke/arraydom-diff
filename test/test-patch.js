'use strict'

const test = require('tape')
const diff = require('..')

/*
  You do things with this like you do with DOM's "document", but it
  just logs what you do to it, which you see in .log.

  For the human reader, it numbers the DOM nodes starting at 1000.  We
  start up there to keep them clearly distinct from refnums.

*/
function fakeDocument () {
  const log = []
  const d = {}
  let k = 1000
  d.log = log

  function fakeNode (k) {
    const n = {k: k}
    n.remove = () => log.push(['remove', k])
    n.appendChild = ch => log.push(['appendChild', k, ch.k])
    n.style = {}
    n.dataset = {}
    n.setAttribute = (s, v) => {
      log.push(['set', k, s, v])
    }
    return n
  }

  d.body = fakeNode(k++)
  
  d.createTextNode = s => {
    log.push(['create', k, 'text', s])
    return fakeNode(k++)
  }
  d.createElement = s => {
    log.push(['create', k, 'element', s])
    return fakeNode(k++)
  }
  return d
}

test('create', t => {
  t.plan(1)
  const doc = fakeDocument()
  doc.createElement('div')
  doc.createTextNode('hello')
  t.deepEqual(doc.log,
              [ [ 'create', 1001, 'element', 'div' ], [ 'create', 1002, 'text', 'hello' ] ]

             )

})

test('build', t => {
  t.plan(1)
  const doc = fakeDocument()
  const div = doc.createElement('div')
  div.appendChild(doc.createTextNode('hello'))
  t.deepEqual(doc.log,
              [ [ 'create', 1001, 'element', 'div' ], [ 'create', 1002, 'text', 'hello' ], [ 'appendChild', 1001, 1002 ] ]
             )
})

test('patch remove root', t => {
  t.plan(1)
  const doc = fakeDocument()
  const p = [
    { method: 'remove',
      object: 0
    }
  ]
  diff.patch(doc.body, p, doc)
  t.deepEqual(doc.log, [ [ 'remove', 1000 ] ]
             )
})

test('patch some attributes', t => {
  t.plan(3)
  const doc = fakeDocument()
  const p = [
    { method: 'setAttribute',
      object: 0,
      attribute: '$font-weight',
      value: 10
    },
    { method: 'setAttribute',
      object: 0,
      attribute: '$fooBar',
      value: 20
    },
    { method: 'setAttribute',
      object: 0,
      attribute: 'plain',
      value: 30
    },
    { method: 'setAttribute',
      object: 0,
      attribute: '_dataValue',
      value: 40
    }
  ]
  diff.patch(doc.body, p, doc)
  console.error({doc})
  t.deepEqual(doc.log,
              [ [ 'set', 1000, 'plain', 30 ] ]
             )
  t.deepEqual(doc.body.style,
              { fontWeight: 10, fooBar: 20 }
             )
  t.deepEqual(doc.body.dataset,
              { dataValue: 40 }
             )
})
