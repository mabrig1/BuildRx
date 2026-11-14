/**
 * Whitelisted local coding exercises. Code executes only inside the isolated
 * browser practice runner; no repository writes, remote builds or certificates.
 */
export type PlaygroundKind = "javascript" | "html" | "css";
export type PlaygroundExercise = {
  id: string; trackId: "software-engineering" | "systems-engineering" | "fullstack-web" | "mobile-app";
  kind: PlaygroundKind; title: string; level: string; minutes: number;
  objective: string; instructions: string; lesson: string;
  start: string; functionName?: string; fixedHtml?: string;
  tests?: readonly { label: string; args: unknown[]; expected: unknown }[];
  checks?: readonly { label: string; pattern: string; flags: string }[];
  hints: readonly string[]; explanation: string;
};
export const PLAYGROUND_EXERCISES: readonly PlaygroundExercise[] = [
  {
    "id": "js-totals",
    "trackId": "software-engineering",
    "kind": "javascript",
    "title": "Calculate a reliable checkout total",
    "level": "Beginner",
    "minutes": 15,
    "objective": "Write a pure JavaScript function; verify several inputs, including a zero-quantity item.",
    "lesson": "se03",
    "instructions": "Implement calculateTotal(items). Each item has a numeric price and quantity. Return the sum of price × quantity. An empty array totals zero. Do not mutate input.",
    "start": "function calculateTotal(items) {\n  // Return the sum of price * quantity.\n  return 0;\n}\n",
    "functionName": "calculateTotal",
    "tests": [
      {
        "label": "One notebook",
        "args": [
          [
            {
              "price": 100,
              "quantity": 1
            }
          ]
        ],
        "expected": 100
      },
      {
        "label": "Multiple products",
        "args": [
          [
            {
              "price": 150,
              "quantity": 2
            },
            {
              "price": 40,
              "quantity": 3
            }
          ]
        ],
        "expected": 420
      },
      {
        "label": "Empty basket",
        "args": [
          []
        ],
        "expected": 0
      },
      {
        "label": "Zero quantity",
        "args": [
          [
            {
              "price": 99,
              "quantity": 0
            }
          ]
        ],
        "expected": 0
      },
      {
        "label": "Decimal price",
        "args": [
          [
            {
              "price": 19.5,
              "quantity": 2
            }
          ]
        ],
        "expected": 39
      }
    ],
    "hints": [
      "Try using a for...of loop or Array.prototype.reduce.",
      "Start with total = 0; for each item add item.price * item.quantity."
    ],
    "explanation": "A pure function is easier to test. Production checkout also needs server-side validation of actual prices; browser totals are only presentation."
  },
  {
    "id": "js-slots",
    "trackId": "systems-engineering",
    "kind": "javascript",
    "title": "Find slots that are not booked",
    "level": "Intermediate",
    "minutes": 20,
    "objective": "Practice data filtering before learning atomic database reservations.",
    "lesson": "sys03",
    "instructions": "Implement availableSlots(slots, booked). Return a new array with slots not in booked, preserving order. Treat slots as strings. Do not modify either input.",
    "start": "function availableSlots(slots, booked) {\n  // Filter slots that have not already been booked.\n  return slots;\n}\n",
    "functionName": "availableSlots",
    "tests": [
      {
        "label": "One reserved",
        "args": [
          [
            "09:00",
            "10:00",
            "11:00"
          ],
          [
            "10:00"
          ]
        ],
        "expected": [
          "09:00",
          "11:00"
        ]
      },
      {
        "label": "Nothing reserved",
        "args": [
          [
            "08:00",
            "09:00"
          ],
          []
        ],
        "expected": [
          "08:00",
          "09:00"
        ]
      },
      {
        "label": "Everything reserved",
        "args": [
          [
            "08:00"
          ],
          [
            "08:00"
          ]
        ],
        "expected": []
      },
      {
        "label": "Empty slots",
        "args": [
          [],
          [
            "10:00"
          ]
        ],
        "expected": []
      },
      {
        "label": "Preserves source order",
        "args": [
          [
            "17:00",
            "09:00",
            "14:00"
          ],
          [
            "14:00"
          ]
        ],
        "expected": [
          "17:00",
          "09:00"
        ]
      }
    ],
    "hints": [
      "Create a new array instead of editing slots.",
      "Return slots.filter(slot => !booked.includes(slot))."
    ],
    "explanation": "This filters *displayed availability* only. A production booking API must reserve slots atomically in the database to avoid double bookings."
  },
  {
    "id": "js-authorization",
    "trackId": "systems-engineering",
    "kind": "javascript",
    "title": "Model an authorization decision",
    "level": "Intermediate",
    "minutes": 20,
    "objective": "Practice a policy decision that denies unrelated users.",
    "lesson": "sys03",
    "instructions": "Implement mayEditIssue(issue,viewer). Return true if viewer.role is 'admin' or viewer.id equals issue.ownerId, otherwise false. Missing viewers must be denied. This is a learning exercise, not production authorization.",
    "start": "function mayEditIssue(issue, viewer) {\n  // Return a Boolean. Deny by default.\n  return true;\n}\n",
    "functionName": "mayEditIssue",
    "tests": [
      {
        "label": "Owner can edit",
        "args": [
          {
            "ownerId": "a1"
          },
          {
            "id": "a1",
            "role": "member"
          }
        ],
        "expected": true
      },
      {
        "label": "Another member denied",
        "args": [
          {
            "ownerId": "a1"
          },
          {
            "id": "b2",
            "role": "member"
          }
        ],
        "expected": false
      },
      {
        "label": "Administrator allowed",
        "args": [
          {
            "ownerId": "a1"
          },
          {
            "id": "z9",
            "role": "admin"
          }
        ],
        "expected": true
      },
      {
        "label": "Visitor denied",
        "args": [
          {
            "ownerId": "a1"
          },
          {
            "id": "z9",
            "role": "guest"
          }
        ],
        "expected": false
      },
      {
        "label": "Missing viewer denied",
        "args": [
          {
            "ownerId": "a1"
          },
          null
        ],
        "expected": false
      }
    ],
    "hints": [
      "Check that viewer exists before reading its fields.",
      "Use Boolean(viewer && (viewer.role === 'admin' || viewer.id === issue.ownerId))."
    ],
    "explanation": "Never trust a client-supplied viewer.role in production. Read the session server-side and enforce row ownership and RLS, not only a browser helper."
  },
  {
    "id": "js-search",
    "trackId": "mobile-app",
    "kind": "javascript",
    "title": "Filter offline-friendly search results",
    "level": "Beginner",
    "minutes": 15,
    "objective": "Create a small, testable filtering routine suitable for web or React Native.",
    "lesson": "mob04",
    "instructions": "Implement findMatches(names,query). Return items whose names contain the trimmed, case-insensitive query. If the query is blank return a copy of names. Preserve original item casing and order.",
    "start": "function findMatches(names, query) {\n  // Return matching names without changing the input array.\n  return [];\n}\n",
    "functionName": "findMatches",
    "tests": [
      {
        "label": "Case insensitive",
        "args": [
          [
            "Apple",
            "banana",
            "Pineapple"
          ],
          "app"
        ],
        "expected": [
          "Apple",
          "Pineapple"
        ]
      },
      {
        "label": "Trim spaces",
        "args": [
          [
            "Lagos",
            "Abuja",
            "LAGOS Island"
          ],
          "  lagos  "
        ],
        "expected": [
          "Lagos",
          "LAGOS Island"
        ]
      },
      {
        "label": "Empty query",
        "args": [
          [
            "A",
            "B"
          ],
          ""
        ],
        "expected": [
          "A",
          "B"
        ]
      },
      {
        "label": "No matching names",
        "args": [
          [
            "A",
            "B"
          ],
          "Z"
        ],
        "expected": []
      },
      {
        "label": "Empty source",
        "args": [
          [],
          "A"
        ],
        "expected": []
      }
    ],
    "hints": [
      "Use query.trim().toLowerCase().",
      "Use names.filter(name => name.toLowerCase().includes(normalizedQuery))."
    ],
    "explanation": "Filtering works offline with available data; saving a list locally and securely syncing edits is a separate mobile exercise."
  },
  {
    "id": "html-booking",
    "trackId": "fullstack-web",
    "kind": "html",
    "title": "Build an accessible booking form",
    "level": "Beginner",
    "minutes": 15,
    "objective": "Write semantic HTML that users and assistive technology can navigate.",
    "lesson": "web02",
    "instructions": "Write an HTML form with a visible h1, a label associated with an input for a customer name, a button, and a required field. The preview cannot submit to a server; focus on semantic markup.",
    "start": "<main>\n  <h1>Book a visit</h1>\n  <!-- Add <form>, linked label and input, and submit button. -->\n</main>\n",
    "checks": [
      {
        "label": "Has an h1 heading",
        "pattern": "<h1\\b",
        "flags": "i"
      },
      {
        "label": "Contains a form",
        "pattern": "<form\\b",
        "flags": "i"
      },
      {
        "label": "Has a visible label",
        "pattern": "<label\\b",
        "flags": "i"
      },
      {
        "label": "Has an input field",
        "pattern": "<input\\b",
        "flags": "i"
      },
      {
        "label": "Has a required field",
        "pattern": "\\brequired\\b",
        "flags": "i"
      },
      {
        "label": "Has a submit button",
        "pattern": "<button\\b",
        "flags": "i"
      }
    ],
    "hints": [
      "Use <label for=\"customer\">Name</label> and <input id=\"customer\" required>.",
      "Place the input and <button type=\"submit\">Book</button> inside <form>."
    ],
    "explanation": "These are introductory structural checks, not a full accessibility audit. Real booking requires a server route, authorization, storage and end-to-end testing."
  },
  {
    "id": "css-mobile",
    "trackId": "mobile-app",
    "kind": "css",
    "title": "Design a responsive mobile-first card",
    "level": "Beginner",
    "minutes": 15,
    "objective": "Write CSS for a card layout that adapts to narrow screens.",
    "lesson": "mob02",
    "instructions": "Style the provided HTML. Give .grid a grid layout, define spacing and at least one responsive @media rule. Preview in the embedded mobile-size panel. This exercises responsive CSS, not React Native.",
    "start": ".grid {\n  /* Use CSS Grid */\n}\n\n.card {\n  padding: 1rem;\n}\n\n/* Add a @media rule for wider screens */\n",
    "fixedHtml": "<main><h1>My visits</h1><div class=\"grid\"><article class=\"card\"><h2>Visit one</h2><p>Morning appointment</p></article><article class=\"card\"><h2>Visit two</h2><p>Afternoon appointment</p></article></div></main>",
    "checks": [
      {
        "label": "Uses CSS Grid",
        "pattern": "display\\s*:\\s*grid",
        "flags": "i"
      },
      {
        "label": "Sets a grid column layout",
        "pattern": "grid-template-columns\\s*:",
        "flags": "i"
      },
      {
        "label": "Adds a media query",
        "pattern": "@media\\b",
        "flags": "i"
      },
      {
        "label": "Styles card spacing",
        "pattern": "\\.card\\s*\\{[^}]*padding\\s*:",
        "flags": "i"
      }
    ],
    "hints": [
      "Try .grid { display: grid; gap: 1rem; grid-template-columns: 1fr; }.",
      "Add @media (min-width: 40rem) { .grid { grid-template-columns: repeat(2, 1fr); } }."
    ],
    "explanation": "Responsive web CSS and native React Native styles have different engines. This is a web CSS foundations exercise, not a compiled Android/iOS app."
  },
  {
    "id": "js-idempotency",
    "trackId": "systems-engineering",
    "kind": "javascript",
    "title": "Remove duplicate booking requests",
    "level": "Intermediate",
    "minutes": 20,
    "objective": "Deduplicate retryable submission IDs without altering the original order.",
    "lesson": "sys02",
    "instructions": "Implement uniqueRequestIds(ids). Return the first occurrence of every string ID, preserving input order. Never mutate the incoming array.",
    "start": "function uniqueRequestIds(ids) {\n  // Keep the first occurrence of each identifier.\n  return ids;\n}\n",
    "functionName": "uniqueRequestIds",
    "tests": [
      {
        "label": "Keep first occurrence",
        "args": [
          [
            "r1",
            "r2",
            "r1",
            "r3"
          ]
        ],
        "expected": [
          "r1",
          "r2",
          "r3"
        ]
      },
      {
        "label": "Empty input",
        "args": [
          []
        ],
        "expected": []
      },
      {
        "label": "No duplicates",
        "args": [
          [
            "a",
            "b"
          ]
        ],
        "expected": [
          "a",
          "b"
        ]
      },
      {
        "label": "One repeated ID",
        "args": [
          [
            "z",
            "z",
            "z"
          ]
        ],
        "expected": [
          "z"
        ]
      },
      {
        "label": "Case-sensitive IDs",
        "args": [
          [
            "ID",
            "id",
            "ID"
          ]
        ],
        "expected": [
          "ID",
          "id"
        ]
      }
    ],
    "hints": [
      "Track which identifiers have already appeared.",
      "Return [...new Set(ids)] or use a Set while iterating."
    ],
    "explanation": "Deduplication is a teaching example only; real request idempotency must be enforced atomically on the server."
  },
  {
    "id": "js-backoff",
    "trackId": "systems-engineering",
    "kind": "javascript",
    "title": "Calculate bounded retry delays",
    "level": "Intermediate",
    "minutes": 20,
    "objective": "Implement exponential backoff with a reasonable maximum delay.",
    "lesson": "sys04",
    "instructions": "Implement retryDelay(attempt). For non-negative integer attempts return min(1000 * 2**attempt, 8000) milliseconds. Invalid inputs return -1. No timers or network requests should be started.",
    "start": "function retryDelay(attempt) {\n  // Return -1 for invalid attempts, otherwise a capped delay.\n  return 0;\n}\n",
    "functionName": "retryDelay",
    "tests": [
      {
        "label": "First attempt",
        "args": [
          0
        ],
        "expected": 1000
      },
      {
        "label": "Second attempt",
        "args": [
          1
        ],
        "expected": 2000
      },
      {
        "label": "Third attempt",
        "args": [
          2
        ],
        "expected": 4000
      },
      {
        "label": "Cap applies",
        "args": [
          10
        ],
        "expected": 8000
      },
      {
        "label": "Negative attempt rejected",
        "args": [
          -1
        ],
        "expected": -1
      },
      {
        "label": "Fractional attempt rejected",
        "args": [
          1.5
        ],
        "expected": -1
      }
    ],
    "hints": [
      "Use Number.isInteger(attempt) and check attempt >= 0.",
      "Use Math.min(1000 * 2 ** attempt, 8000) after checking input."
    ],
    "explanation": "Real retries also need idempotency, limits, jitter, cancellation and a dead-letter plan."
  },
  {
    "id": "js-data-summary",
    "trackId": "fullstack-web",
    "kind": "javascript",
    "title": "Summarize statuses for an analytics dashboard",
    "level": "Beginner",
    "minutes": 20,
    "objective": "Turn an array of status strings into count summaries.",
    "lesson": "web03",
    "instructions": "Implement countStatuses(statuses). Return an object with keys open, closed and pending counting matching lowercase status strings. Ignore other values. Do not mutate inputs.",
    "start": "function countStatuses(statuses) {\n  return { open: 0, closed: 0, pending: 0 };\n}\n",
    "functionName": "countStatuses",
    "tests": [
      {
        "label": "Mixed statuses",
        "args": [
          [
            "open",
            "closed",
            "open",
            "pending"
          ]
        ],
        "expected": {
          "open": 2,
          "closed": 1,
          "pending": 1
        }
      },
      {
        "label": "Empty array",
        "args": [
          []
        ],
        "expected": {
          "open": 0,
          "closed": 0,
          "pending": 0
        }
      },
      {
        "label": "Unknown ignored",
        "args": [
          [
            "other",
            "open"
          ]
        ],
        "expected": {
          "open": 1,
          "closed": 0,
          "pending": 0
        }
      },
      {
        "label": "All closed",
        "args": [
          [
            "closed",
            "closed"
          ]
        ],
        "expected": {
          "open": 0,
          "closed": 2,
          "pending": 0
        }
      },
      {
        "label": "Case sensitivity",
        "args": [
          [
            "Open",
            "open"
          ]
        ],
        "expected": {
          "open": 1,
          "closed": 0,
          "pending": 0
        }
      }
    ],
    "hints": [
      "Create an output object with all three keys initially set to 0.",
      "Loop through statuses, and increment only when the key is one of the three supported statuses."
    ],
    "explanation": "Frontend aggregations are not a substitute for authorization, trustworthy data queries, or analytics validation."
  },
  {
    "id": "js-validation",
    "trackId": "fullstack-web",
    "kind": "javascript",
    "title": "Validate a registration display name",
    "level": "Beginner",
    "minutes": 15,
    "objective": "Return a clear validation result that can be unit tested.",
    "lesson": "web02",
    "instructions": "Implement validateName(name). Return {ok:true,value:trimmed} only for strings whose trimmed length is between 3 and 40 inclusive. Otherwise return {ok:false,value:''}. Do not modify the original input.",
    "start": "function validateName(name) {\n  // Check the type and trimmed length.\n  return { ok: false, value: '' };\n}\n",
    "functionName": "validateName",
    "tests": [
      {
        "label": "Valid normal name",
        "args": [
          "Amina"
        ],
        "expected": {
          "ok": true,
          "value": "Amina"
        }
      },
      {
        "label": "Whitespace trim",
        "args": [
          "  Chika  "
        ],
        "expected": {
          "ok": true,
          "value": "Chika"
        }
      },
      {
        "label": "Too short",
        "args": [
          " Al "
        ],
        "expected": {
          "ok": false,
          "value": ""
        }
      },
      {
        "label": "Non-string rejected",
        "args": [
          null
        ],
        "expected": {
          "ok": false,
          "value": ""
        }
      },
      {
        "label": "Upper length boundary",
        "args": [
          "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        ],
        "expected": {
          "ok": true,
          "value": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        }
      },
      {
        "label": "Over max length",
        "args": [
          "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        ],
        "expected": {
          "ok": false,
          "value": ""
        }
      }
    ],
    "hints": [
      "Reject when typeof name !== 'string'.",
      "Use const cleaned = name.trim(); return based on cleaned.length >= 3 && cleaned.length <= 40."
    ],
    "explanation": "Use this to understand testable validation rules, but real auth systems require further server-side controls."
  },
  {
    "id": "js-mobile-queue",
    "trackId": "mobile-app",
    "kind": "javascript",
    "title": "Identify offline drafts awaiting synchronization",
    "level": "Intermediate",
    "minutes": 20,
    "objective": "Separate offline drafts from confirmed server records.",
    "lesson": "mob04",
    "instructions": "Implement pendingDraftIds(drafts). Each draft has id:string and synced:boolean. Return IDs where synced is exactly false, preserving order. Ignore entries with missing IDs; do not mutate inputs.",
    "start": "function pendingDraftIds(drafts) {\n  // Only return id strings from records with synced === false.\n  return [];\n}\n",
    "functionName": "pendingDraftIds",
    "tests": [
      {
        "label": "Mixed records",
        "args": [
          [
            {
              "id": "a",
              "synced": false
            },
            {
              "id": "b",
              "synced": true
            },
            {
              "id": "c",
              "synced": false
            }
          ]
        ],
        "expected": [
          "a",
          "c"
        ]
      },
      {
        "label": "All synchronized",
        "args": [
          [
            {
              "id": "a",
              "synced": true
            }
          ]
        ],
        "expected": []
      },
      {
        "label": "Empty list",
        "args": [
          []
        ],
        "expected": []
      },
      {
        "label": "Missing IDs ignored",
        "args": [
          [
            {
              "synced": false
            },
            {
              "id": "x",
              "synced": false
            }
          ]
        ],
        "expected": [
          "x"
        ]
      },
      {
        "label": "Unknown sync status excluded",
        "args": [
          [
            {
              "id": "y"
            },
            {
              "id": "z",
              "synced": false
            }
          ]
        ],
        "expected": [
          "z"
        ]
      }
    ],
    "hints": [
      "Use filter then map, or build an output array with a loop.",
      "Only include items where draft.synced === false && typeof draft.id === 'string'."
    ],
    "explanation": "Pending offline drafts must not be presented as confirmed server bookings. Real sync requires conflict and idempotency handling."
  },
  {
    "id": "js-safe-role",
    "trackId": "software-engineering",
    "kind": "javascript",
    "title": "Calculate permissions without privilege escalation",
    "level": "Intermediate",
    "minutes": 20,
    "objective": "Practice default-deny role decisions and negative test cases.",
    "lesson": "se03",
    "instructions": "Implement canViewReport(user). Return true only when user is a non-null object with role exactly 'analyst' or 'admin'. Return false for all other inputs, including absent roles.",
    "start": "function canViewReport(user) {\n  // Deny unless the role is an explicitly permitted value.\n  return true;\n}\n",
    "functionName": "canViewReport",
    "tests": [
      {
        "label": "Analyst allowed",
        "args": [
          {
            "role": "analyst"
          }
        ],
        "expected": true
      },
      {
        "label": "Administrator allowed",
        "args": [
          {
            "role": "admin"
          }
        ],
        "expected": true
      },
      {
        "label": "Guest denied",
        "args": [
          {
            "role": "guest"
          }
        ],
        "expected": false
      },
      {
        "label": "Missing role denied",
        "args": [
          {}
        ],
        "expected": false
      },
      {
        "label": "Null denied",
        "args": [
          null
        ],
        "expected": false
      },
      {
        "label": "Substring is not role",
        "args": [
          {
            "role": "admin-extra"
          }
        ],
        "expected": false
      }
    ],
    "hints": [
      "Check the user exists and its role matches an allowlist.",
      "Return Boolean(user && (user.role === 'analyst' || user.role === 'admin'))."
    ],
    "explanation": "A frontend helper is not access control. Production authorization must use server-verified identity and ownership policies."
  }
];
export function getPlaygroundExercise(id: string): PlaygroundExercise | undefined {
  return PLAYGROUND_EXERCISES.find((challenge) => challenge.id === id);
}
