import type { CatalogItem, Finish, Material } from '../db/types';

/** פריט ספרייה מוכן, לפני שנזרע — חותמות הזמן נקבעות בזריעה עצמה. */
/*
 * פריט שמגיע עם האפליקציה.
 *
 * הבעלות והגרסה אינן חלק ממנו: הן נקבעות ברגע שהוא נזרע אל נגרייה
 * מסוימת. רשימה שנושאת בעלות הייתה טוענת שהיא שייכת למישהו עוד
 * לפני שהותקנה.
 */
export type ShippedItem = Omit<CatalogItem, 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'>;
export type ShippedMaterial = Omit<Material, 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'>;
export type ShippedFinish = Omit<Finish, 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'>;

/**
 * הספרייה שמגיעה עם האפליקציה, כשהיא נבנתה בנגרייה ולא נכתבה בקוד.
 *
 * ארגזי התקן שב-`builtins.ts` הם נקודת פתיחה: מידות מקובלות, שמות
 * מקובלים, מה שאפשר להתחיל ממנו ביום הראשון. הספרייה האמיתית של
 * נגרייה נבנית בעבודה — ארגז שנבנה פעם אחת נכון, ומאז מוזמן שוב.
 *
 * מי שבנה אותה מייצא אותה ממסך "גיבוי והעברה", והקובץ הזה נכתב
 * ממנה על ידי `scripts/library-to-seed.mjs`. מרגע שהוא אינו ריק,
 * הוא זה שנזרע — ומה שכתוב ב-`builtins.ts` כבר אינו מוצג.
 *
 * נכתב בכלי, לא ביד.
 */
export const SHIPPED_LIBRARY: ShippedItem[] = [
  {
    "id": "f3072627-f242-4d22-9056-ff08bbdd5b40",
    "code": "EC-002",
    "name": "ארון כיור דלתות",
    "rooms": [
      "bathroom"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "sink",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 550,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 550,
    "defaultDepthMm": 480,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 20,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 0
  },
  {
    "id": "02a4174d-214a-4064-9d57-b092a604a219",
    "code": "EC-003",
    "name": "ארון כיור מגירות",
    "rooms": [
      "bathroom"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "drawers",
    "doors": 0,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 550,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "outer"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 550,
    "defaultDepthMm": 480,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 20,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 1
  },
  {
    "id": "b9d436a8-da0e-4123-b03c-fd0eb5098474",
    "code": "EC-004",
    "name": "ארון מגירות אמבטיה",
    "rooms": [
      "bathroom"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "drawers",
    "doors": 0,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 550,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "outer"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 550,
    "defaultDepthMm": 480,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 2
  },
  {
    "id": "8f44d765-643b-4ce9-8ea6-81d7b8dbeddd",
    "code": "EC-005",
    "name": "ארון תחתון דלתות — אמבטיה",
    "rooms": [
      "bathroom"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 550,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 550,
    "defaultDepthMm": 480,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 3
  },
  {
    "id": "c98f4749-7ffc-4a88-a379-3dc96ab432a4",
    "code": "EC-006",
    "name": "ארון מראה",
    "rooms": [
      "bathroom"
    ],
    "group": "upper",
    "level": "wall",
    "glyph": "mirror",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 160,
    "defaultYMm": 1900,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 4
  },
  {
    "id": "ce1cebf5-ebb9-4e73-8607-73a0345fbb15",
    "code": "EC-007",
    "name": "ארון סל כביסה",
    "rooms": [
      "bathroom"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 450,
    "widthOptionsMm": [
      450
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 500,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 5
  },
  {
    "id": "bcfeaf50-8ca2-46f6-bf08-5ced98c52628",
    "code": "EC-008",
    "name": "עמודת מגבות / שירות",
    "rooms": [
      "bathroom"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 4,
    "zones": [
      {
        "id": "main",
        "heightMm": 2000,
        "kind": "shelves",
        "shelves": 4
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 400,
    "widthOptionsMm": [
      400
    ],
    "defaultHeightMm": 2000,
    "defaultDepthMm": 450,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 6
  },
  {
    "id": "c1c5499a-47d6-488d-816e-98613102e018",
    "code": "EC-009",
    "name": "אי מגירות לחדר ארונות",
    "rooms": [
      "closet"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "drawers",
    "doors": 0,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 900,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "outer",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 1200,
    "widthOptionsMm": [
      1200
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 800,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 7
  },
  {
    "id": "db5bf267-9b35-4f1e-9314-38b6d4a51897",
    "code": "EC-010",
    "name": "ארון נעליים פתוח",
    "rooms": [
      "closet"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "open",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 4,
    "zones": [
      {
        "id": "main",
        "heightMm": 1800,
        "kind": "shelves",
        "shelves": 4
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 1800,
    "defaultDepthMm": 350,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 8
  },
  {
    "id": "40457038-c7e9-4149-9fe3-4966c5bceeb8",
    "code": "EC-011",
    "name": "יחידת מגירות",
    "rooms": [
      "closet"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "drawers",
    "doors": 0,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 2,
    "zones": [
      {
        "id": "main",
        "heightMm": 1200,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "outer",
        "shelves": 2
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 1200,
    "defaultDepthMm": 550,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 9
  },
  {
    "id": "40a82989-90f7-4a5c-a11a-00dda85329f1",
    "code": "EC-012",
    "name": "יחידת מדפים",
    "rooms": [
      "closet"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "shelves",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "main",
        "heightMm": 2400,
        "kind": "shelves",
        "shelves": 5
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 500,
    "widthOptionsMm": [
      500
    ],
    "defaultHeightMm": 2400,
    "defaultDepthMm": 450,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 10
  },
  {
    "id": "efb23421-f3ee-4dd5-bae1-e6b8b0bd1629",
    "code": "EC-013",
    "name": "יחידת תלייה ארוכה",
    "rooms": [
      "closet"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "hang",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "main",
        "heightMm": 2400,
        "kind": "rod",
        "shelves": 5
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2400,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 11
  },
  {
    "id": "f6214c9a-d129-41bb-9cca-bd1eb9f79f2a",
    "code": "EC-014",
    "name": "יחידת תלייה כפולה",
    "rooms": [
      "closet"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "hangDouble",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "lower",
        "heightMm": 1200,
        "kind": "rod"
      },
      {
        "id": "upper",
        "heightMm": 1200,
        "kind": "rod"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 2400,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 12
  },
  {
    "id": "4dbc6952-d094-45a7-8ba4-2b2391db8806",
    "code": "EC-015",
    "name": "פינת חדר ארונות פתוחה",
    "rooms": [
      "closet"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "lShape",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "main",
        "heightMm": 2400,
        "kind": "shelves",
        "shelves": 5
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 900,
    "widthOptionsMm": [
      900
    ],
    "defaultHeightMm": 2400,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "corner": "lShape",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 13
  },
  {
    "id": "c6f5f9ef-ad91-4f3a-8904-b87910b560b1",
    "code": "EC-016",
    "name": "ארון נמוך דלתות",
    "rooms": [
      "children"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "doors",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 400,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 14
  },
  {
    "id": "29b09a29-391d-4805-876f-64e56016438e",
    "code": "EC-017",
    "name": "ארון צעצועים נמוך",
    "rooms": [
      "children"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "doors",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 600,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 600,
    "defaultDepthMm": 400,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 15
  },
  {
    "id": "51b9fd6a-bd73-4067-b9b7-13c522d7e374",
    "code": "EC-018",
    "name": "ארון ילדים משולב",
    "rooms": [
      "children"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "doors",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "hang",
        "heightMm": 1430,
        "kind": "rod"
      },
      {
        "id": "shelves",
        "heightMm": 770,
        "kind": "shelves",
        "shelves": 2
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 900,
    "widthOptionsMm": [
      900
    ],
    "defaultHeightMm": 2200,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 16
  },
  {
    "id": "8a83b9e6-83c1-4faa-8dcf-814fecc13443",
    "code": "EC-019",
    "name": "ארון ילדים תלייה",
    "rooms": [
      "children"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "hang",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "main",
        "heightMm": 2200,
        "kind": "rod",
        "shelves": 5
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2200,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 17
  },
  {
    "id": "1b1e639c-2383-42cd-a682-62d40b77be69",
    "code": "EC-020",
    "name": "ארון תלוי לחדר ילדים",
    "rooms": [
      "children"
    ],
    "group": "upper",
    "level": "wall",
    "glyph": "doors",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 600,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 600,
    "defaultDepthMm": 320,
    "defaultYMm": 2000,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 18
  },
  {
    "id": "1dd69d02-263b-49c5-944a-1c606df47ce3",
    "code": "EC-021",
    "name": "יחידת מגירות לשולחן ילדים",
    "rooms": [
      "children"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "drawers",
    "doors": 0,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "outer",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 400,
    "widthOptionsMm": [
      400
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 450,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 19
  },
  {
    "glyph": "doors",
    "doors": 2,
    "id": "1b0e7203-510f-40aa-a800-32c03f44553a",
    "code": "EC-022",
    "name": "ארגז עליון לארון בגדים",
    "rooms": [
      "bedroom"
    ],
    "group": "upper",
    "level": "wall",
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 500,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 500,
    "defaultDepthMm": 600,
    "defaultYMm": 1900,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 20
  },
  {
    "id": "d6aa1cd1-5f5d-4e7a-93ae-8e4aa9ac0ada",
    "code": "EC-023",
    "name": "ארון בגדים תלייה",
    "rooms": [
      "bedroom"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "hang",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "main",
        "heightMm": 2400,
        "kind": "rod",
        "shelves": 5
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2400,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 21
  },
  {
    "id": "ce5c6661-162f-4e79-a480-4735b64240e3",
    "code": "EC-024",
    "name": "ארון מגירות פנימיות",
    "rooms": [
      "bedroom"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "innerDrawers",
    "doors": 1,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "main",
        "heightMm": 2400,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "inner",
        "shelves": 5
      }
    ],
    "drawerStyle": "inner",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2400,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 22
  },
  {
    "glyph": "shelves",
    "backKind": "carcass",
    "id": "f4b551cc-b004-4dda-aad8-ab81130e795a",
    "code": "EC-025",
    "name": "ארון מדפים",
    "rooms": [
      "bedroom"
    ],
    "group": "tall",
    "level": "tall",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "main",
        "heightMm": 2400,
        "kind": "shelves",
        "shelves": 5
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 500,
    "widthOptionsMm": [
      500
    ],
    "defaultHeightMm": 2500,
    "defaultDepthMm": 550,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 23
  },
  {
    "id": "b49635c0-81cb-48da-9eb8-da3bc8d1937a",
    "code": "EC-026",
    "name": "ארון משולב תלייה ומדפים",
    "rooms": [
      "bedroom"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "hang",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "hang",
        "heightMm": 1560,
        "kind": "rod"
      },
      {
        "id": "shelves",
        "heightMm": 840,
        "kind": "shelves",
        "shelves": 2
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 1000,
    "widthOptionsMm": [
      1000
    ],
    "defaultHeightMm": 2400,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 24
  },
  {
    "id": "f3d0393f-1a6d-4e2c-a003-a48710724ded",
    "code": "EC-027",
    "name": "ארון תלייה כפולה",
    "rooms": [
      "bedroom"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "hangDouble",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 5,
    "zones": [
      {
        "id": "lower",
        "heightMm": 1200,
        "kind": "rod"
      },
      {
        "id": "upper",
        "heightMm": 1200,
        "kind": "rod"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 2400,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 25
  },
  {
    "glyph": "doors",
    "doors": 2,
    "id": "30f64ca2-a797-4a9e-a177-39665e614bbe",
    "code": "EC-028",
    "name": "שידה תלויה ליד מיטה",
    "rooms": [
      "bedroom"
    ],
    "group": "upper",
    "level": "wall",
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 300,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 500,
    "widthOptionsMm": [
      500
    ],
    "defaultHeightMm": 300,
    "defaultDepthMm": 400,
    "defaultYMm": 1900,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 26
  },
  {
    "glyph": "drawers",
    "drawers": 4,
    "id": "6d015edc-1d5a-41fe-a276-51f572fe8fdf",
    "code": "EC-029",
    "name": "שידת מגירות",
    "rooms": [
      "bedroom"
    ],
    "group": "base",
    "level": "floor",
    "doors": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "drawers",
        "drawers": 4,
        "drawerCols": 1,
        "drawerStyle": "outer",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 450,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 27
  },
  {
    "id": "2594486a-d290-400a-a55c-0d9a00a2bb33",
    "code": "EC-030",
    "name": "ארון מעל מכונת כביסה",
    "rooms": [
      "utility"
    ],
    "group": "upper",
    "level": "wall",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 600,
    "defaultYMm": 1900,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 28
  },
  {
    "id": "e530f0bb-540f-4605-b737-9ff31493cc21",
    "code": "EC-031",
    "name": "ארון עליון שירות",
    "rooms": [
      "utility"
    ],
    "group": "upper",
    "level": "wall",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 350,
    "defaultYMm": 1900,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 29
  },
  {
    "id": "d9dfe65e-fe80-4106-9123-9f5a3d23c7bc",
    "code": "EC-032",
    "name": "ארון כיור שירות",
    "rooms": [
      "utility"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "sink",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 20,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 30
  },
  {
    "id": "6f8dd7ea-96ad-4d38-a07b-239716d94d8c",
    "code": "EC-033",
    "name": "ארון מגירות שירות",
    "rooms": [
      "utility"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "drawers",
    "doors": 0,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "outer",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 31
  },
  {
    "id": "14fa08e8-eb15-42c4-993e-c66f605ed0c9",
    "code": "EC-034",
    "name": "ארון תחתון שירות",
    "rooms": [
      "utility"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 32
  },
  {
    "id": "77216976-12c9-40d9-96ed-caa06e6d6966",
    "code": "EC-035",
    "name": "סל כביסה נשלף",
    "rooms": [
      "utility"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 450,
    "widthOptionsMm": [
      450
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 550,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 33
  },
  {
    "id": "b017b8b9-b454-441e-9121-81279801b6f6",
    "code": "EC-036",
    "name": "עמודת מטאטא",
    "rooms": [
      "utility"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 2100,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 450,
    "widthOptionsMm": [
      450
    ],
    "defaultHeightMm": 2200,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 34
  },
  {
    "id": "14811c5a-f622-4f69-be75-280a3ade9c54",
    "code": "EC-037",
    "name": "עמודת מכונת כביסה ומייבש",
    "rooms": [
      "utility"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "open",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 2100,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 650,
    "widthOptionsMm": [
      650
    ],
    "defaultHeightMm": 2200,
    "defaultDepthMm": 680,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 35
  },
  {
    "id": "11fc4f8a-0fc4-4356-8432-1b1a8347e8e2",
    "code": "EC-038",
    "name": "עמודת שירות מדפים",
    "rooms": [
      "utility"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "shelves",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 4,
    "zones": [
      {
        "id": "main",
        "heightMm": 2100,
        "kind": "shelves",
        "shelves": 4
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2200,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 36
  },
  {
    "id": "6269d75d-8919-410a-9bee-fec142ad5ac8",
    "code": "EC-041",
    "name": "ארון נעליים נמוך",
    "rooms": [
      "entrance"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "shoes",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 900,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 350,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 37
  },
  {
    "id": "a7c5aad8-0fe3-4f56-a20e-16f742f75017",
    "code": "EC-042",
    "name": "ארון מעילים",
    "rooms": [
      "entrance"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "hang",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 4,
    "zones": [
      {
        "id": "main",
        "heightMm": 2100,
        "kind": "rod",
        "shelves": 4
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2100,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 38
  },
  {
    "id": "5bc420da-6e74-4646-bb3c-72bb103d803b",
    "code": "EC-043",
    "name": "ארון מפתחות תלוי",
    "rooms": [
      "entrance"
    ],
    "group": "upper",
    "level": "wall",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 500,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 400,
    "widthOptionsMm": [
      400
    ],
    "defaultHeightMm": 500,
    "defaultDepthMm": 180,
    "defaultYMm": 2100,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 39
  },
  {
    "id": "c5d30d9d-4c26-4388-97fd-3a8cad055bea",
    "code": "EC-044",
    "name": "ארון נעליים תלוי",
    "rooms": [
      "entrance"
    ],
    "group": "upper",
    "level": "wall",
    "glyph": "shoes",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 600,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 600,
    "defaultDepthMm": 320,
    "defaultYMm": 2000,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 40
  },
  {
    "id": "6e118d33-4d8b-4733-adbb-25719a9f8603",
    "code": "EC-045",
    "name": "ספסל אחסון",
    "rooms": [
      "entrance"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "doors",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 450,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 1000,
    "widthOptionsMm": [
      1000
    ],
    "defaultHeightMm": 450,
    "defaultDepthMm": 450,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 41
  },
  {
    "id": "cdfa8e5f-b6d1-403b-b87c-6a61f0aa9511",
    "code": "EC-046",
    "name": "ארון ייבוש כלים",
    "rooms": [
      "kitchen"
    ],
    "group": "upper",
    "level": "wall",
    "glyph": "shelves",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 720,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 720,
    "defaultDepthMm": 330,
    "defaultYMm": 1500,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 42
  },
  {
    "glyph": "open",
    "id": "ee8dfaca-2b0a-4002-92a8-8c6c4b9fb793",
    "code": "EC-047",
    "name": "ארון לקולט אדים",
    "rooms": [
      "kitchen"
    ],
    "group": "upper",
    "level": "wall",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 720,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 720,
    "defaultDepthMm": 330,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 43
  },
  {
    "glyph": "open",
    "id": "b57fb14e-08e3-479b-a394-a8a854dbba91",
    "code": "EC-048",
    "name": "ארון מיקרוגל / נישה פתוחה",
    "rooms": [
      "kitchen"
    ],
    "group": "upper",
    "level": "wall",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 450,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 450,
    "defaultDepthMm": 400,
    "defaultYMm": 1500,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 44
  },
  {
    "glyph": "doors",
    "doors": 1,
    "id": "552fccf2-4e5f-46ec-99a7-3ea2211df1cd",
    "code": "EC-049",
    "name": "ארון עליון דלתות",
    "rooms": [
      "kitchen"
    ],
    "group": "upper",
    "level": "wall",
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 720,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 720,
    "defaultDepthMm": 330,
    "defaultYMm": 1500,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 45
  },
  {
    "glyph": "open",
    "id": "d5e8ecf2-7cd3-4e00-be51-ad3ae9723b4b",
    "code": "EC-050",
    "name": "ארון עליון פתוח",
    "rooms": [
      "kitchen"
    ],
    "group": "upper",
    "level": "wall",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 600,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 600,
    "defaultDepthMm": 330,
    "defaultYMm": 1500,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 46
  },
  {
    "glyph": "lift",
    "opening": "lift",
    "backKind": "carcass",
    "id": "b381822c-722e-4551-9bd8-bb507e9ac7aa",
    "code": "EC-051",
    "name": "ארון עליון קלפה",
    "rooms": [
      "kitchen"
    ],
    "group": "upper",
    "level": "wall",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 400,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 400,
    "defaultDepthMm": 330,
    "defaultYMm": 1440,
    "socleMm": 0,
    "counterMm": 0,
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 47
  },
  {
    "glyph": "doors",
    "doors": 1,
    "id": "9f8b11bc-81cb-4c1c-83ac-f14931abe7cd",
    "code": "EC-052",
    "name": "ארון בקבוקים נשלף",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 300,
    "widthOptionsMm": [
      300
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 48
  },
  {
    "glyph": "sink",
    "shelves": 0,
    "backKind": "carcass",
    "rails": {
      "back": true,
      "top": true
    },
    "id": "8363b7dd-63ca-480b-8f23-af7ce38f9d1e",
    "code": "EC-053",
    "name": "ארון כיור",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 30,
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 49
  },
  {
    "glyph": "drawers",
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "outer",
        "shelves": 1
      }
    ],
    "backKind": "carcass",
    "rails": {
      "back": false,
      "top": false
    },
    "id": "5f01837d-7a87-4a97-9ab8-b0122afbb42c",
    "code": "EC-054",
    "name": "ארון כיריים עם מגירות",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "doors": 0,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 1,
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 50
  },
  {
    "glyph": "doors",
    "doors": 1,
    "id": "da3651ef-cdff-4574-9b58-476081dd979a",
    "code": "EC-055",
    "name": "ארון תחתון דלתות — מטבח",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 51
  },
  {
    "glyph": "doors",
    "doors": 2,
    "id": "7c1f4a90-2d3e-4b86-9a51-0f6d8c2e4b17",
    "code": "EC-081",
    "name": "ארון תחתון שתי דלתות",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800,
      900,
      1000
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 52
  },
  {
    "glyph": "drawers",
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "outer",
        "shelves": 1
      }
    ],
    "backKind": "carcass",
    "rails": {
      "back": false,
      "top": false
    },
    "id": "53c4697c-0d5f-4467-b6c1-5f24ede4ffd9",
    "code": "EC-056",
    "name": "ארון תחתון מגירות",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "doors": 0,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 1,
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 53
  },
  {
    "glyph": "drawers",
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "drawers",
        "drawers": 1,
        "drawerCols": 1,
        "drawerStyle": "outer"
      }
    ],
    "backKind": "carcass",
    "rails": {
      "back": false,
      "top": false
    },
    "id": "c30af3b7-e99e-48ed-b31e-028586b88dd0",
    "code": "EC-057",
    "name": "ארון תנור עם מגירה",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "doors": 0,
    "drawers": 1,
    "drawerCols": 1,
    "shelves": 0,
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 54
  },
  {
    "glyph": "open",
    "id": "8a581932-104f-4a98-a44c-71a52e01b0fc",
    "code": "EC-058",
    "name": "ארון תנור תחתון",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 55
  },
  {
    "id": "a064a481-b9bc-4902-894f-db74db697aba",
    "code": "EC-059",
    "name": "ארון פינה L",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "lShape",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 900,
    "widthOptionsMm": [
      900
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 20,
    "backKind": "thin",
    "drawerBox": "metal",
    "corner": "lShape",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 56
  },
  {
    "id": "0ca2db45-29e8-4d44-b1c8-af329c65e55e",
    "code": "EC-060",
    "name": "עמודת מזווה מגירות פנימיות",
    "rooms": [
      "kitchen"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "innerDrawers",
    "doors": 1,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 4,
    "zones": [
      {
        "id": "main",
        "heightMm": 2100,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "inner",
        "shelves": 4
      }
    ],
    "drawerStyle": "inner",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2200,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 57
  },
  {
    "id": "1616ff5e-8163-45a1-9d0c-f10df246fd48",
    "code": "EC-061",
    "name": "עמודת מזווה מדפים",
    "rooms": [
      "kitchen"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "shelves",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 4,
    "zones": [
      {
        "id": "main",
        "heightMm": 2100,
        "kind": "shelves",
        "shelves": 4
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2200,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 58
  },
  {
    "glyph": "open",
    "zones": [
      {
        "id": "main",
        "heightMm": 2100,
        "kind": "empty"
      }
    ],
    "backKind": "none",
    "omit": {
      "bottom": true
    },
    "id": "c9cd50ca-d7b2-40b5-837f-30768b3f7b1f",
    "code": "EC-062",
    "name": "עמודת מקרר אינטגרלי",
    "rooms": [
      "kitchen"
    ],
    "group": "tall",
    "level": "tall",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2100,
    "defaultDepthMm": 600,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 59
  },
  {
    "glyph": "open",
    "zones": [
      {
        "id": "main",
        "heightMm": 2100,
        "kind": "empty"
      }
    ],
    "backKind": "none",
    "omit": {
      "bottom": true
    },
    "id": "12e0e98c-145b-4c4a-b0e4-bbc73f064090",
    "code": "EC-063",
    "name": "עמודת תנור",
    "rooms": [
      "kitchen"
    ],
    "group": "tall",
    "level": "tall",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2100,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 60
  },
  {
    "glyph": "open",
    "zones": [
      {
        "id": "main",
        "heightMm": 2100,
        "kind": "empty"
      }
    ],
    "backKind": "none",
    "omit": {
      "bottom": true
    },
    "id": "13e68ac2-3e5a-424e-9c55-dd00f38676fc",
    "code": "EC-064",
    "name": "עמודת תנור ומיקרוגל",
    "rooms": [
      "kitchen"
    ],
    "group": "tall",
    "level": "tall",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2100,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "drawerBox": "metal",
    "note": "תבנית ארגז. מרווחי מכשיר, צנרת ופרזול ייעודי דורשים מידות יצרן לפני ייצור.",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 61
  },
  {
    "glyph": "blindEnd",
    "doors": 1,
    "corner": "blindEnd",
    "blindMm": 550,
    "backKind": "carcass",
    "drawerBox": "metal",
    "id": "802fc3f7-9d18-4e35-8836-3ddc2b15978c",
    "code": "EC-065",
    "name": "פינה מתה ימין",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 900,
    "widthOptionsMm": [
      900
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 30,
    "common": true,
    "isBuiltin": true,
    "sortOrder": 62
  },
  {
    "glyph": "blindStart",
    "doors": 1,
    "shelves": 1,
    "corner": "blindStart",
    "blindMm": 550,
    "backKind": "carcass",
    "id": "be7e86d1-d449-4bb3-bfa8-1b8ca75f0326",
    "code": "EC-066",
    "name": "פינה מתה שמאל",
    "rooms": [
      "kitchen"
    ],
    "group": "base",
    "level": "floor",
    "drawers": 0,
    "drawerCols": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 800,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 900,
    "widthOptionsMm": [
      900
    ],
    "defaultHeightMm": 900,
    "defaultDepthMm": 580,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 20,
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 63
  },
  {
    "id": "18167eb7-9ec9-45ee-a9a4-1a8060c36fe0",
    "code": "EC-068",
    "name": "ארון נמוך למשרד",
    "rooms": [
      "office"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "doors",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 720,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 720,
    "defaultDepthMm": 450,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 64
  },
  {
    "id": "646b9c8b-da34-4222-afaa-0838fb61b953",
    "code": "EC-069",
    "name": "יחידת מגירות לשולחן",
    "rooms": [
      "office"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "drawers",
    "doors": 0,
    "drawers": 3,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 720,
        "kind": "drawers",
        "drawers": 3,
        "drawerCols": 1,
        "drawerStyle": "outer",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 450,
    "widthOptionsMm": [
      450
    ],
    "defaultHeightMm": 720,
    "defaultDepthMm": 500,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 65
  },
  {
    "id": "6c3be67a-052d-4233-9f50-38aacf83e934",
    "code": "EC-070",
    "name": "ארון עליון למשרד",
    "rooms": [
      "office"
    ],
    "group": "upper",
    "level": "wall",
    "glyph": "doors",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 350,
    "defaultYMm": 1900,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 66
  },
  {
    "id": "c8fa0c85-6202-432c-91e8-6820e419cc67",
    "code": "EC-071",
    "name": "ארון קלסרים גבוה",
    "rooms": [
      "office"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "doors",
    "doors": 1,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 4,
    "zones": [
      {
        "id": "main",
        "heightMm": 2000,
        "kind": "shelves",
        "shelves": 4
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2000,
    "defaultDepthMm": 400,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 67
  },
  {
    "id": "dac22878-5cdd-464a-a2de-a06a6c1ae53e",
    "code": "EC-072",
    "name": "גשר אחסון מעל שולחן",
    "rooms": [
      "office"
    ],
    "group": "upper",
    "level": "wall",
    "glyph": "doors",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 500,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 1200,
    "widthOptionsMm": [
      1200
    ],
    "defaultHeightMm": 500,
    "defaultDepthMm": 350,
    "defaultYMm": 2100,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 68
  },
  {
    "id": "963fcb04-5283-4fe1-a6d6-88f96602cfc0",
    "code": "EC-073",
    "name": "מדפים פתוחים למשרד",
    "rooms": [
      "office"
    ],
    "group": "base",
    "level": "floor",
    "glyph": "open",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 300,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 69
  },
  {
    "id": "0e03f085-15f0-4a87-999a-5caef41d259e",
    "code": "EC-074",
    "name": "ספרייה גבוהה",
    "rooms": [
      "office"
    ],
    "group": "tall",
    "level": "tall",
    "glyph": "shelves",
    "doors": 2,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 4,
    "zones": [
      {
        "id": "main",
        "heightMm": 2000,
        "kind": "shelves",
        "shelves": 4
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 2000,
    "defaultDepthMm": 350,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 70
  },
  {
    "glyph": "glass",
    "doors": 1,
    "shelves": 4,
    "backKind": "carcass",
    "glassDoors": true,
    "id": "23650060-5aca-4665-bb4c-eb3b16f87101",
    "code": "EC-075",
    "name": "ארון תצוגה עליון",
    "rooms": [
      "living"
    ],
    "group": "upper",
    "level": "wall",
    "drawers": 0,
    "drawerCols": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "shelves",
        "shelves": 4
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 350,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 71
  },
  {
    "glyph": "doors",
    "doors": 4,
    "shelves": 0,
    "backKind": "carcass",
    "doorCells": 4,
    "id": "f744bfbf-c9a5-4a0c-a5f1-c3183447fb24",
    "code": "EC-076",
    "name": "מזנון טלוויזיה רצפתי",
    "rooms": [
      "living"
    ],
    "group": "base",
    "level": "floor",
    "drawers": 0,
    "drawerCols": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 450,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 1800,
    "widthOptionsMm": [
      1800
    ],
    "defaultHeightMm": 550,
    "defaultDepthMm": 450,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 72
  },
  {
    "glyph": "doors",
    "doors": 1,
    "id": "d9da5286-6a3a-4a81-a587-3455e3ae8a9a",
    "code": "EC-077",
    "name": "ארון קיר תלוי",
    "rooms": [
      "living"
    ],
    "group": "upper",
    "level": "wall",
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 700,
        "kind": "shelves",
        "shelves": 1
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 800,
    "widthOptionsMm": [
      800
    ],
    "defaultHeightMm": 700,
    "defaultDepthMm": 350,
    "defaultYMm": 1500,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 73
  },
  {
    "glyph": "glass",
    "doors": 1,
    "shelves": 4,
    "backKind": "carcass",
    "glassDoors": true,
    "id": "8f377b6b-30cb-4021-b833-5710d4fdb824",
    "code": "EC-078",
    "name": "ויטרינה גבוהה",
    "rooms": [
      "living"
    ],
    "group": "tall",
    "level": "tall",
    "drawers": 0,
    "drawerCols": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 2000,
        "kind": "shelves",
        "shelves": 4
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 600,
    "widthOptionsMm": [
      600
    ],
    "defaultHeightMm": 2100,
    "defaultDepthMm": 400,
    "defaultYMm": 0,
    "socleMm": 100,
    "counterMm": 0,
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 74
  },
  {
    "glyph": "open",
    "id": "9dbed582-29eb-4408-bb98-ebaf01147889",
    "code": "EC-079",
    "name": "יחידת מדיה פתוחה",
    "rooms": [
      "living"
    ],
    "group": "base",
    "level": "floor",
    "doors": 0,
    "drawers": 0,
    "drawerCols": 1,
    "shelves": 0,
    "zones": [
      {
        "id": "main",
        "heightMm": 500,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 1200,
    "widthOptionsMm": [
      1200
    ],
    "defaultHeightMm": 500,
    "defaultDepthMm": 450,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "backKind": "thin",
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 75
  },
  {
    "glyph": "doors",
    "doors": 4,
    "shelves": 0,
    "backKind": "carcass",
    "doorCells": 4,
    "id": "b25d6943-9690-4f8b-88a6-d1f042ffc7b9",
    "code": "EC-080",
    "name": "מזנון טלוויזיה תלוי",
    "rooms": [
      "living"
    ],
    "group": "upper",
    "level": "wall",
    "drawers": 0,
    "drawerCols": 1,
    "zones": [
      {
        "id": "main",
        "heightMm": 350,
        "kind": "empty"
      }
    ],
    "drawerStyle": "outer",
    "defaultWidthMm": 1800,
    "widthOptionsMm": [
      1800
    ],
    "defaultHeightMm": 350,
    "defaultDepthMm": 420,
    "defaultYMm": 0,
    "socleMm": 0,
    "counterMm": 0,
    "drawerBox": "metal",
    "common": true,
    "isBuiltin": true,
    "sortOrder": 76
  }
];

/**
 * הלוחות והגוונים שהספרייה הזו מפנה אליהם.
 *
 * ארגז שומר מזהה של גוון, לא את הגוון עצמו. בלי השניים האלה, ספרייה
 * שנבנתה בנגרייה הייתה מגיעה למכשיר חדש עם הפניות לשום דבר: הצבע
 * שנבחר לחזית לא היה קיים, והמחיר לא היה מחושב. הם נזרעים עם
 * המזהים המקוריים שלהם, וזה מה שמחזיק את ההפניות.
 */
export const SHIPPED_MATERIALS: ShippedMaterial[] = [];
export const SHIPPED_FINISHES: ShippedFinish[] = [];
