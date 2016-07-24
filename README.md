
Arraydom Diff
=============

Compute a relatively minimal set of changes one would need to perform
on some tree (like the browser DOM) to turn it into another.  While in
general I understand this is O(n^3), since we're thinking in terms of
the DOM we can take a lot of shortcuts.   (cf how React does it.)

Mutation Steps
--------------

The steps we can apply to t0 (the tree being changed) correspond to
DOM Level 1 operations:

Long form (what we normally use )

```js
  { method: 'remove',     
    object: refnum of node to be removed
  }
  { method: 'appendChild'
    parent: refnum of parent
    child: creation expression or refnum of node to move
  }
  { method: 'insertBefore'
    sibling: refnum of sibling this goes before (never null)
    inserted: creation expression or refnum of node to move
  }
  { method: 'setAttribute',
    object: refnum of node to have its attribute set
    attribute: 'attrname'              '$foo-bar' means '.style.fooBar'
    value: 'value' }
  { method: 'deleteAttribute',
    object: refnum of node to have its attribute deleted
    attribute: 'attrname'              '$foo-bar' means '.style.fooBar'
  }
```

If one needed to put these into bytes, one might gzip it, or come up
with a compact encoding like [ op arg op arg arg op arg arg ... ]
where op would be 0 for remove, 1 for appendChild, ... its args would
as above but assigned positions.  The args for setAttribute would need
to be length + content.

Creation Expressions
--------------------

For a text node:

```js
'Hello, World'
```

For an element node tree:

```js
['div', attrs, child1, ... ]
```

refnums
-------

In the operations, we refer to nodes using integers.  A node with
refnum x is the node encountered in step x during a pre-order
traversal of the tree.  For example:

[ 1 [ 2 [ 3 4 ] 5 ] 6 [ 7 ] ]

Zero would be the root, referring to that whole string.
