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
  }
];
export function getPlaygroundExercise(id: string): PlaygroundExercise | undefined {
  return PLAYGROUND_EXERCISES.find((challenge) => challenge.id === id);
}
