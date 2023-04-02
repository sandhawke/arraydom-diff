import * as struct from '../arraydom/struct.js'
import dbg from 'debug'

const debug = dbg('arraydom-diff')
const tagName = struct.tagName
const attr = struct.attr
const attrNames = struct.attrNames
// window.jsdebug = require('debug')
// window.jsdebug.enable('arraydom-diff')
function scalar (x) {
  return (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')
}
function patch (t0, steps, options) {
  // backward compatibilty, options might just be the document
  if (options?.createTextNode) options = {document: options}
  // easy override for 'document' for testing
  const doc = options?.document || document

  // refnum[3] is the node with refnum 3, ie at pre-order index 3
  const refnum = buildRefnumArray(t0, steps)
  
  // for debugging in browser
  if (typeof window !== 'undefined') { window.refnum = refnum }
  
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
  for (const step of steps) {
    // console.log('patch step', step)
    if (step.method === 'remove') {
      refnum[step.object].remove()
    } else if (step.method === 'appendChild') {
      refnum[step.parent].appendChild(refOrNew(step.child))
    } else if (step.method === 'insertBefore') {
      refnum[step.sibling].parentNode.insertBefore(refOrNew(step.inserted), refnum[step.sibling])
    } else if (step.method === 'setAttribute') {
      set(refnum[step.object], step.attribute, step.value)
    } else if (step.method === 'deleteAttribute') {
      unset(refnum[step.object], step.attribute)
    } else { throw Error('unknown patch method') }
  }
}

// return doc.createElement(...) with the whole tree + attrs
function construct (a, doc) {
  if (typeof a === 'string') { return doc.createTextNode(a) }
  if (typeof a === 'number') { return doc.createTextNode('' + a) }
  const e = doc.createElement(tagName(a))
  for (const name of attrNames(a, true, true)) {
    set(e, name, attr(a, name))
  }
  for (const child of a.slice(2)) {
    e.appendChild(construct(child, doc))
  }
  return e
}
// window.construct = construct
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
    const stylekey = key.slice(1).replace(/-[^-]/g, x => x[1].toUpperCase())
    if (!node.style) {
      console.error('node.style not defined', node)
    }
    node.style[stylekey] = val
    debug('set style.', stylekey, ' = ', val)
  } else {
    // which of these is better?   setAttribute doesn't work when
    // val is a function.
    // xxx node.setAttribute(key, val)
    if (!node) {
      console.error('node not defined', node, key, val)
    }
    // capricious difference between HTML attribute and DOM attribute
    if (key === 'class') { key = 'className' }
    // node[key] = val
    if (node.setAttribute) {
      node.setAttribute(key, val)
    } else {
      console.error('node has no setAttribute?', {node, key, val})
    }
    debug('set ', key, ' = ', val)
  }
}
function unset (node, key, val) {
  if (key[0] === '_') {
    delete node.dataset[key.slice(1)]
  } else if (key[0] === '$') {
    const stylekey = key.slice(1).replace(/-[^-]/g, x => x[1].toUpperCase())
    delete node.style[stylekey]
  } else {
    node.removeAttribute(key)
  }
}
/*
  Return a sorted array of the refnums used anywhere in the given steps

  Actually we don't need this, since we're no longer using a sparse
  array, but we might switch back to sparse array, so I'm keeping it
  here for now.

function buildRefList (steps) {
  const refs = new Set()
  for (const step of steps) {
    for (const prop of ['object', 'parent', 'child', 'sibling', 'inserted']) {
      if (typeof step[prop] === 'number') { refs.add(step[prop]) }
    }
  }
  const refsArray = Array.from(refs)
  refsArray.sort()
  return refsArray
}
*/

/*
  Return an array mapping refnum ==> nodes in t0
*/
function buildRefnumArray (t0) {
  const result = []
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
    // debug('removed called with', x)
    steps.push({ method: 'remove', object: x })
    // debug('PUSHED: ', steps.slice(-1))
  }
  function appendChild (x, child) {
    steps.push({ method: 'appendChild', parent: x, child })
  }
  function insertBefore (i, s) {
    steps.push({ method: 'insertBefore', inserted: i, sibling: s })
  }
  function setAttribute (x, k, v) {
    steps.push({ method: 'setAttribute', object: x, attribute: k, value: v })
  }
  function deleteAttribute (x, k) {
    steps.push({ method: 'deleteAttribute', object: x, attribute: k })
  }
  function alignable (a, b) {
    if (scalar(a) && scalar(b)) {
      // the DOM supports textContent, but I think it'll slow our
      // algorithm down here, if we don't treat text basically as
      // anchors.  I think apps will be inserting and deleting
      // elements, not textnodes.
      return a === b
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      // we can't change tagNames
      // http://stackoverflow.com/questions/3435871/jquery-how-to-change-tag-name
      if (tagName(a) !== tagName(b)) { return false }
      // and it seems like a bad idea to change ids.  By forbidding
      // the changing of ids, I think the algorithm will perform a
      // lot better
      if (attr(a, 'id') !== attr(b, 'id')) { return false }
      if (attr(a, 'key') !== attr(b, 'key')) { return false }
      // ... anything else?
      return true
    }
    return false
    // debug('cant tell if alignable', a, b)
    // throw Error()
  }
  // Return the index (or -1) of the next sibling in b (>=
  // minIndex) which is alignable with the given item
  function nextAlignable (element, b, minIndex) {
    for (let jj = minIndex; jj < b.length; jj++) {
      const aligns = alignable(element, b[jj])
      // debug('alignable? ', element, b[jj], aligns)
      if (aligns) { return jj }
    }
    return -1
  }
  function align (a, b) {
    debug('align', a, b)
    if (!alignable(a, b)) { throw Error() } // should never be here
    if (scalar(a)) { return }
    const refnumSaved = refnum
    adjustAttributes(refnumSaved, a, b)
    let i = 2 // offset of first child ASSUMES attrs
    let j = 2 // offset of first child ASSUMES attrs
    while (i < a.length) {
      const child = a[i]
      refnum++
      debug('starting align loop', i, a[i], j, b[j], refnum)
      const nextj = nextAlignable(child, b, j)
      if (nextj === j) {
        debug('alignable at', i, j)
        align(a[i], b[j])
        i++
        j++
      } else if (nextj === -1) {
        debug('align delete child at', i, refnum)
        // child cannot align with anything in the rest of b, so
        // delete it -- it's of no use to us, sorry.  We don't look
        // for where else in the tree it might be useful.
        debug('calling remove with', refnum)
        remove(refnum)
        refnum += (nodeCount(a[i]) - 1)
        i++
      } else {
        // child CAN align with some later sibling, so create the children
        // for the interving nodes
        while (j < nextj) {
          debug('align insertBefore ', b[j], refnum)
          insertBefore(deepCopy(b[j]), refnum)
          j++
        }
        // undo that refnum increment, since we didn't actually move this loop
        refnum--
      }
    }
    while (j < b.length) {
      debug('align append children, because ', j, b.length)
      appendChild(refnumSaved, deepCopy(b[j]))
      j++
    }
  }
  function adjustAttributes (refnum, a, b) {
    const old = new Set()
    for (const name of attrNames(a, true, true)) {
      old.add(name)
    }
    for (const name of attrNames(b, true, true)) {
      const val = attr(b, name)
      if (val === null) {
        deleteAttribute(refnum, name)
      } else {
        if (a[name] !== val) {
          setAttribute(refnum, name, val)
        }
      }
      old.delete(name)
    }
    for (const name of old) {
      deleteAttribute(refnum, name)
    }
  }
  if (!alignable(t0, t1)) {
    // or maybe we should use node.replaceChild() for this?
    // otherwise muck around...??
    throw Error('Not allowed to change root tagName or id ')
  }
  refnum = 0
  align(t0, t1)
  debug('aligned', t0, t1)
  return steps
}
function deepCopy (a) {
  if (scalar(a)) {
    return a
  }
  if (Array.isArray(a)) {
    const result = []
    for (const aa of a) {
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
function nodeCount (a) {
  let n = 1
  if (Array.isArray(a)) {
    if (scalar(a[1]) || Array.isArray(a[1])) { throw Error('missing attrs in slot 1') }
    for (let i = 2; i < a.length; i++) {
      n += nodeCount(a[i])
    }
  }
  return n
}
export { construct }
export { patch }
export { diff }
export { deepCopy }
export { buildRefnumArray }
export { nodeCount }

/*
export function* compareToDOM (tree, elem) {
  const pos = {tree, elem}
  if (tree === undefined) { yield {pos, op: 'tree undef'}; return }
  if (elem === undefined) { yield {pos, op: 'elem undef'}; return }

  if (scalar(tree) || elem.nodeType === elem.TEXT_NODE) {
    if (scalar(tree) && elem.nodeType === elem.TEXT_NODE) {
      if (tree === elem.textContent) return
      if (tree.toString() === elem.textContent) return
      if (tree.toString().trim() === elem.textContent.trim()) {
        yield {pos, op: 'trim'}
        return
      }
    }
    yield {pos, op: 'scalar mismatch'}
    return
  }

  if (elem.tagName.toLowerCase() !== tree[0]) {
    yield {pos, op: 'tag mismatch'}
    return
  }
  
  const used = new Set()
  for (const key of elem.getAttributeNames()) {
    used.add(key)
    const eValue = elem.getAttribute(key)
    const tValue = tree[1]?.[key]
  }
  
  let child = elem.firstChild
  let i = 2
  while (child) {
    yield* compareToDOM(tree[i], child)
    child = child.nextSibling
    i++
  }
  if (i !== tree.length) { yield {pos, op: 'short dom'}; return }
  
}
*/

export function fromDOMInner (elem) {
  return ['', {}, ...fromDOM(elem).slice(2)]
}

export function fromDOM (elem) {
  if (elem === undefined) return undefined
  switch (elem.nodeType) {
  case elem.TEXT_NODE:
    return elem.textContent
  case elem.ATTRIBUTE_NODE:
    throw Error('unexpected node type')
  case elem.ELEMENT_NODE:
    const tag = elem.tagName.toLowerCase()
    const attrs = fromDOMAttrs(elem)
    const tree = [tag, attrs]

    let child = elem.firstChild
    while (child) {
      tree.push(fromDOM(child))
      child = child.nextSibling
    }
    return tree
  case elem.CDATA_SECTION_NODE:
    throw Error('unexpected node type')
  case elem.PROCESSING_INSTRUCTION_NODE:
    throw Error('unexpected node type')
  case elem.COMMENT_NODE:
    throw Error('unexpected node type')
  case elem.DOCUMENT_NODE:
    throw Error('unexpected node type')
  case elem.DOCUMENT_TYPE_NODE:
    throw Error('unexpected node type')
  case elem.DOCUMENT_FRAGMENT_NODE:
    throw Error('unexpected node type')
  default:
    throw Error('unexpected node type')
  }
}

export function fromDOMAttrs (elem) {
  const out = {}
  for (const key of elem.getAttributeNames()) {
    const value = elem.getAttribute(key)
    // types?  style object vs style string?
    out[key] = value
  }
  return out
}
