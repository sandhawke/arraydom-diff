'use strict'

const struct = require('../arraydom/struct.js')
const debug = require('debug')('arraydom-diff')

const tagName   = struct.tagName
const attr      = struct.attr
const attrNames = struct.attrNames

//window.jsdebug = require('debug')
//window.jsdebug.enable('*')

function scalar (x) {
  return (typeof x === 'string' || typeof x === 'number')
}

function patch (t0, steps, doc) {
  if (!doc) doc = document // easy override for 'document' for testing
  
  // refnum[3] is the node with refnum 3, ie at pre-order index 3
  const refnum = buildRefnumArray(t0, steps)

  // while debugging in browser
  if (typeof window !== 'undefined') window.refnum = refnum

  function refOrNew (expr) {
    if (expr.refnum) {
      // allow diffs to have nodes moved around arbitrarily, even
      // though our diff() never does that.  We can't just pass the
      // number here, because we allow numbers (which are later turned
      // into strings) in arraydom trees.
      return refnum[expr]
    }
    return construct(expr, doc)
  }
  
  for (let step of steps) {
    //debug('step', step)
    if (step.method === 'remove') {
      refnum[step.object].remove()
    } else if (step.method === 'appendChild') {
      refnum[step.parent].appendChild(refOrNew(step.child))
    } else if (step.method === 'insertBefore') {
      refnum[step.sibling].parentNode.insertBefore(refOrNew(step.inserted),
                                                   refnum[step.sibling])
    } else if (step.method === 'setAttribute') {
      set(refnum[step.object], step.attribute, step.value)
    } else if (step.method === 'deleteAttribute') {
      unset(refnum[step.object], step.attribute)
    } else throw Error('unknown patch method')
  }
}

// return doc.createElement(...) with the whole tree + attrs
function construct (a, doc) {
  if (typeof a === 'string') return doc.createTextNode(a)
  if (typeof a === 'number') return doc.createTextNode('' + a)
  const e = doc.createElement(tagName(a))
  for (let name of attrNames(a, true, true)) {
    set(e, name, attr(a, name))
  }
  for (let child of a.slice(2)) {
    e.appendChild(construct(child, doc))
  }
  return e
}
//window.construct = construct

/*
  This is interesting because we smoosh .style and .dataset into the key

  set(n, 'a', val)  =>   n.setAttribute('a', val)
  set(n, '$a', val) =>   n.style.a = val
  set(n, '$a-b', val) =>   n.style.aB = val
  set(n. '_a', val) =>   n.dataset.a = val 
*/
function set (node, key, val) {
  if (key[0] === '_') {
    node.dataset[key.slice(1)] = val
  } else if (key[0] === '$') {
    let stylekey = key.slice(1).replace(/-[^-]/g, x => x[1].toUpperCase())
    node.style[stylekey] = val
  } else {
    node.setAttribute(key, val)
  }
}
function unset (node, key, val) {
  if (key[0] === '_') {
    delete node.dataset[key.slice(1)]
  } else if (key[0] === '$') {
    let stylekey = key.slice(1).replace(/-[^-]/g, x => x[1].toUpperCase())
    delete node.style[stylekey]
  } else {
    node.deleteAttribute(key)
  }
}


/*
  Return a sorted array of the refnums used anywhere in the given steps

  Actually we don't need this, since we're no longer using a sparse
  array, but we might switch back to sparse array, so I'm keeping it
  here for now.
*/
function buildRefList (steps) {
  const refs = new Set()
  for (let step of steps) {
    for (let prop of ['object', 'parent', 'child', 'sibling', 'inserted']) {
      if (typeof step[prop] === 'number') refs.add(step[prop])
    }
  }
  const refsArray = Array.from(refs)
  refsArray.sort()
  return refsArray
}

/* 
   Return an array mapping refnum ==> nodes in t0 
*/
function buildRefnumArray (t0) {
  let result = []

  function visit (n) {
    // debug('visiting', n)
    result.push(n)
    let child = n.firstChild
    while (child) {
      visit(child)
      child = child.nextSibling
    }
  }

  visit(t0)
  return result
}


/*
  Compute a set of steps one would have to apply to t0 to get t1
*/
function diff (t0, t1) {
  const steps = []
  let refnum

  function remove (x) {
    //debug('removed called with', x)
    steps.push({ method: 'remove', object: x })
    //debug('PUSHED: ', steps.slice(-1))
  }
  function appendChild (x, child) {
    steps.push({ method: 'appendChild', parent:x, child: child })
  }
  function insertBefore (i, s) {
    steps.push({ method: 'insertBefore', inserted: i, sibling: s })
  }
  function setAttribute (x, k, v) {
    steps.push({ method: 'setAttribute', object:x, attribute:k, value: v})
  }
  function deleteAttribute (x, k) {
    steps.push({ method: 'deleteAttribute', object:x, attribute:k})
  }
  
  function alignable (a, b) {
    if (scalar(a) && scalar(b)) {
      // the DOM supports textContent, but I think it'll slow our
      // algorithm down here, if we don't tree text basically as
      // anchors.  I think apps will be inserting and deleting
      // elements, not textnodes.
      return a === b
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      // we can't change tagNames
      // http://stackoverflow.com/questions/3435871/jquery-how-to-change-tag-name
      if (tagName(a) !== tagName(b)) return false
      // and it seems like a bad idea to change ids.  But forbidding
      // the changing of ids, I think the algorithm will perform a
      // lot better
      if (attr(a, 'id') !== attr(b, 'id')) return false
      // ... anything else?
      return true
    }
    return false
    // debug('cant tell if alignable', a, b)
    // throw Error()
  }

  // Return the index (or -1) of the next sibling in b (>= 
  // minIndex) which is alignable with the given item
  function nextAlignable(element, b, minIndex) {
    for (let jj = minIndex; jj < b.length; jj++) {
      const aligns = alignable(element, b[jj])
      //debug('alignable? ', element, b[jj], aligns)
      if (aligns) return jj
    }
    return -1
  }

  function align (a, b) {
    //debug('align', a, b)
    if (!alignable(a,b)) throw Error()  // should never be here
    if (scalar(a)) return
    const refnumSaved = refnum
    adjustAttributes(refnumSaved, a, b)
    let i = 2 // offset of first child ASSUMES attrs
    let j = 2 // offset of first child ASSUMES attrs
    while (i < a.length) {
      //debug('starting align loop', i, a[i], j, b[j])
      let child = a[i]
      refnum++
      let nextj = nextAlignable(child, b, j)
      if (nextj === j) {
        //debug('alignable at', i, j)
        align(a[i], b[j])
        i++
        j++
      } else if (nextj === -1) {
        //debug('align delete child at', i, refnum)
        // child cannot align with anything in the rest of b, so
        // delete it -- it's of no use to us, sorry.  We don't look
        // for where else in the tree it might be useful.
        //debug('calling remove with', refnum)
        remove(refnum)
        i++
      } else {
        // child CAN align with some later sibling, so create the children 
        // for the interving nodes
        while (j < nextj) {
          //debug('align insertBefore ', b[j], refnum)
          insertBefore(deepCopy(b[j]), refnum)
          j++
        }
        // undo that refnum increment, since we didn't actually move this loop
        refnum--
      }
    }
    while (j < b.length) {
      //debug('align append children, because ', j, b.length)
      appendChild(refnumSaved, deepCopy(b[j]))
      j++
    }
  }

  function adjustAttributes (refnum, a, b) {
    const old = new Set()
    for (let name of attrNames(a, true, true)) {
      old.add(name)
    }
    for (let name of attrNames(b, true, true)) {
      let val = attr(b, name)
      if (val === null) {
        deleteAttribute(refnum, name)
      } else {
        if (a[name] !== val) {
          setAttribute(refnum, name, val)
        }
      }
      old.delete(name)
    }
    for (let name of old) {
      deleteAttribute(refnum, name)
    }
  }

  if (!alignable(t0, t1)) {
    // or maybe we should use node.replaceChild() for this?
    // otherwise muck around...??
    throw ('You can\'t patch when the roots are different types')
  }

  refnum = 0
  align(t0, t1)
  //debug('aligned', t0, t1)
  return steps
}

function deepCopy (a) {
  if (scalar(a)) {
    return a
  }
  if (Array.isArray(a)) {
    const result = []
    for (let aa of a) {
      result.push(deepCopy(aa))
    }
    return result
  }
  if (typeof (a) === 'object') {
    return Object.assign({}, a)
  }
  console.error('unexpected object', a)
  throw Error('no other types implemented')
}


module.exports.patch = patch
module.exports.diff = diff
module.exports.deepCopy = deepCopy
module.exports.buildRefnumArray = buildRefnumArray
