/**
 * Definition for singly-linked list.
 * class ListNode {
 *     val: number
 *     next: ListNode | null
 *     constructor(val?: number, next?: ListNode | null) {
 *         this.val = (val===undefined ? 0 : val)
 *         this.next = (next===undefined ? null : next)
 *     }
 * }
 */

function addTwoNumbers(l1: ListNode | null, l2: ListNode | null): ListNode | null {
    let result = null;
    let l1current = l1;
    let l2current = l2;
    let l3current = null;
    let nextValIncr = 0;
    let l3next;

    do {
        // Calc value
        let l1val = (l1current ? l1current.val : 0);
        let l2val = (l2current ? l2current.val : 0);
        let l3val = l1val + l2val + nextValIncr;

        // Handle if it's more than 10
        if (l3val >= 10) {
            nextValIncr = 1;
            l3val = l3val - 10;
        } else {
            nextValIncr = 0;
        }

        // Prep the node
        l3next = new ListNode(l3val);
        if (l3current) {
            l3current.next = l3next;
        }

        // Handle first node
        if (!result) {
            result = l3next;
        }

        // Prep for the next tick
        l3current = l3next;
        l1current = l1current ? l1current.next : null;
        l2current = l2current ? l2current.next : null;
    } while (l1current || l2current);

    // Handling last digit
    if (nextValIncr > 0) {
        l3next = new ListNode(nextValIncr);
        if (l3current) {
            l3current.next = l3next;
        }
    }

    return result;
};