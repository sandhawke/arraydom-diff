'use strict'

const diff = require('..')

let current = ['div', {}]
let t
let elem

function update () {
  const d = diff.diff(current, t)
  current = diff.deepCopy(t)
  // console.log('apply patch: ', d)
  diff.patch(elem, d, document)
}

function go () {

  elem = document.getElementById('out')

  t = ['div', {}, 'hello']
  update()

  t = ['div', {}, 'hello', ', world!']
  update()

  t = ['div', {}, 'Hello', ', world!']
  update()

  t = ['div', {}, 'Hello', ', World!']
  update()

  const attrs = {$color: 'red', $fontWeight: 'bold'}
  t.push(['p', attrs, ' Colored Blink ', ' Text!'])
  update()

  setInterval(() => {
    attrs.$color = 'green'
    update()
    setTimeout( () => {
      attrs.$color= 'red'
      update()
    }, 500)}, 1000)
  
  update()

  t.push(['p', {}, 'Try typing, it should work fine.  This would not work if we were resetting innerHTML or something:', ['br'],
          ['input', {type: 'text',
                     placeholder: 'lorem ipsum'}]])
  t.push(['br'])
  t.push('This animation runs forever on a 10ms timer.  It\'s not going as fast as it can, and each of those underscore/X characters is a different DOM text node).')
  
  const tt = ['p', {}]
  t.push(tt)

  function long () {
    for (let x = 0; x<55; x++) {
      // console.log('=======', x)
      tt.push('_')
      update()
    }

    
    let c = 10
    function count () {
      tt.splice(3+((c-1) % 50), 1, '_')
      tt.splice(3+(c % 50), 1, 'X')
      tt.splice(2, 1, c++)
      update()
      setTimeout(count, 10)
    }
    count()
  }

  // redraw before this starts...
  setTimeout(long, 0)

  

}

addEventListener('DOMContentLoaded', go)
