
Arraydom Diff
=============

This is the clever-algorithms part of [arraydom](https://github.com/sandhawke/arraydom).   Probably you just want to let arraydom call this for you.

diff.diff(t0, t1) returns a list of DOM changes that would be needed to go from arraydom tree t0 to arraydom tree t1.   It should be fast enough that you can run it whenever you think you might have changed something.  Assuming t0 and t1 are pretty similar, it's linear time with the number of nodes, and it's just doing basic javascript.   Quick testing shows me diffing a 2000 node tree in 10ms.

diff.patch(p, document) applies the patch p (returned from diff.diff) to the given document (eg the global 'document' in the browser). 

See the test directory for lots of examples.

Also try the [live demo page](https://rawgit.com/sandhawke/arraydom-diff/master/browser-test/page.html)

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

This is a little verbose, but I'm assuming it's staying memory.  If
you're going to serialize this, you might want a more compact format.

The creation-expressions are just arraydom trees.

refnums
-------

In the operations, we refer to nodes using integers.  A node with
refnum x is the node encountered in step x during a pre-order
traversal of the tree.  For example:

[ 1 [ 2 [ 3 4 ] 5 ] 6 [ 7 ] ]

Zero would be the root, referring to that whole string.

