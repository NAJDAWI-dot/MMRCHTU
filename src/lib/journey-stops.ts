import type { JourneyStop } from "@/lib/journey";

/**
 * The stops of the journey, generated from the captures taken when the
 * competition ended: the registration season rendered as it was, the day
 * site captured live. Note positions are fractions of each capture, measured
 * from the page itself. Regenerate rather than edit the numbers by hand.
 */
export const JOURNEY_STOPS: readonly JourneyStop[] = [
  {
    "id": "home",
    "era": "registration",
    "path": "/",
    "live": false,
    "title": "The front door",
    "intro": "For three months the homepage had one job: get teams signed up.",
    "image": {
      "src": "/journey/home.webp",
      "width": 1280,
      "height": 1432
    },
    "phone": {
      "src": "/journey/home-phone.webp",
      "width": 780,
      "height": 4372
    },
    "notes": [
      {
        "title": "Name, date, the way in",
        "body": "The competition in one line, and nothing standing between a visitor and the form.",
        "x": 0.5,
        "y": 0.1285,
        "phoneY": 0.0952
      },
      {
        "title": "The busiest button",
        "body": "Every team that competed started here.",
        "x": 0.4265,
        "y": 0.2353,
        "phoneY": 0.1903
      },
      {
        "title": "A clock to the day",
        "body": "Counting down to the second. Five days out, the whole site began turning into the day site, a stage a day.",
        "x": 0.5,
        "y": 0.3177,
        "phoneY": 0.274
      },
      {
        "title": "Everything else, one click away",
        "body": "The rules, the schedule, the FAQ and the committee behind it all.",
        "x": 0.1648,
        "y": 0.5454,
        "phoneY": 0.4323
      }
    ]
  },
  {
    "id": "register",
    "era": "registration",
    "path": "/register",
    "live": false,
    "title": "Signing up",
    "intro": "The registration form: one to three members, then payment.",
    "image": {
      "src": "/journey/register.webp",
      "width": 1280,
      "height": 2229
    },
    "phone": {
      "src": "/journey/register-phone.webp",
      "width": 780,
      "height": 5314
    },
    "notes": [
      {
        "title": "The team first",
        "body": "A name, then how many members. Each member gets their own university and contact.",
        "x": 0.5,
        "y": 0.1812,
        "phoneY": 0.1611
      },
      {
        "title": "A fee that follows membership",
        "body": "RAS members, IEEE members and everyone else each had their own price, set as you answered.",
        "x": 0.4242,
        "y": 0.4809,
        "phoneY": 0.4953
      },
      {
        "title": "Ambassadors",
        "body": "Students at each university had a code of their own, so we knew who brought whom.",
        "x": 0.5,
        "y": 0.6747,
        "phoneY": 0.7121
      },
      {
        "title": "Step two",
        "body": "Payment came next, with a proof of payment for the organisers to check.",
        "x": 0.3637,
        "y": 0.7712,
        "phoneY": 0.799
      }
    ]
  },
  {
    "id": "rules",
    "era": "registration",
    "path": "/rules",
    "live": true,
    "title": "The rulebook",
    "intro": "The official rules, as a page you could read on a phone, with widgets to try them out.",
    "image": {
      "src": "/journey/rules.webp",
      "width": 1280,
      "height": 4200
    },
    "phone": {
      "src": "/journey/rules-phone.webp",
      "width": 780,
      "height": 8400
    },
    "notes": [
      {
        "title": "Rules you can actually read",
        "body": "Every section of the rulebook, in plain sections rather than a PDF.",
        "x": 0.5,
        "y": 0.1959,
        "phoneY": 0.2836
      },
      {
        "title": "A maze to look at",
        "body": "A new random 10×10 maze on every load, the same shape as the real one.",
        "x": 0.5,
        "y": 0.3197,
        "phoneY": 0.4674
      },
      {
        "title": "Measure before you build",
        "body": "Two sliders check a chassis against the 25cm limit and the cell clearance.",
        "x": 0.2908,
        "y": 0.785,
        "phoneY": null
      }
    ]
  },
  {
    "id": "micromouse",
    "era": "registration",
    "path": "/micromouse",
    "live": true,
    "title": "The build guide",
    "intro": "How a micromouse works, for teams building their first one.",
    "image": {
      "src": "/journey/micromouse.webp",
      "width": 1280,
      "height": 4200
    },
    "phone": {
      "src": "/journey/micromouse-phone.webp",
      "width": 780,
      "height": 8400
    },
    "notes": [
      {
        "title": "Score first",
        "body": "Sliders that show why a mouse that finishes often beats one that is only fast.",
        "x": 0.5,
        "y": 0.3326,
        "phoneY": 0.503
      },
      {
        "title": "The maze lab",
        "body": "Flood fill, step by step. Knock walls down, move the start corner, and download the maze as a PNG.",
        "x": 0.5,
        "y": 0.6092,
        "phoneY": 0.9939
      },
      {
        "title": "A mouse to take apart",
        "body": "An example robot at real size, part by part.",
        "x": 0.5,
        "y": 0.9212,
        "phoneY": null
      }
    ]
  },
  {
    "id": "game",
    "era": "registration",
    "path": "/game",
    "live": true,
    "title": "Pac Mouse",
    "intro": "Our own maze game, for the wait between the news and the day.",
    "image": {
      "src": "/journey/game.webp",
      "width": 1280,
      "height": 2127
    },
    "phone": {
      "src": "/journey/game-phone.webp",
      "width": 780,
      "height": 4586
    },
    "notes": [
      {
        "title": "Built for the site",
        "body": "Guide the lab mouse round the circuit maze, top-down or first-person.",
        "x": 0.5,
        "y": 0.0611,
        "phoneY": 0.0584
      },
      {
        "title": "A leaderboard worth fighting over",
        "body": "People kept coming back for the top spot.",
        "x": 0.5,
        "y": 0.3888,
        "phoneY": 0.4224
      }
    ]
  },
  {
    "id": "open-day",
    "era": "registration",
    "path": "/open-day",
    "live": false,
    "title": "The open day stand",
    "intro": "A page for the screens at our open day stand. Four things to do, none longer than a minute.",
    "image": {
      "src": "/journey/open-day.webp",
      "width": 1280,
      "height": 3490
    },
    "phone": {
      "src": "/journey/open-day-phone.webp",
      "width": 780,
      "height": 8400
    },
    "notes": [
      {
        "title": "On the stand's screens",
        "body": "What the competition is, a countdown to the doors opening, and four things to try.",
        "x": 0.5,
        "y": 0.0483,
        "phoneY": 0.0411
      },
      {
        "title": "Twenty seconds, no sound",
        "body": "A mouse learns a maze, then runs it. That explains the whole competition.",
        "x": 0.2492,
        "y": 0.1807,
        "phoneY": 0.1858
      },
      {
        "title": "A crest for every team",
        "body": "Type a team name and get a maze built from its letters. The same name always gives the same maze.",
        "x": 0.4094,
        "y": 0.3585,
        "phoneY": 0.378
      },
      {
        "title": "A stand leaderboard",
        "body": "The day's scores only, so visitors played against the people standing next to them.",
        "x": 0.4094,
        "y": 0.5326,
        "phoneY": 0.5943
      }
    ]
  },
  {
    "id": "competition-day",
    "era": "registration",
    "path": "/competition-day",
    "live": true,
    "title": "The day, announced",
    "intro": "Everything about the day itself, published before it.",
    "image": {
      "src": "/journey/competition-day.webp",
      "width": 1280,
      "height": 1912
    },
    "phone": {
      "src": "/journey/competition-day-phone.webp",
      "width": 780,
      "height": 4140
    },
    "notes": [
      {
        "title": "Date and venue",
        "body": "Where to go and when, in one place.",
        "x": 0.5,
        "y": 0.124,
        "phoneY": 0.1068
      },
      {
        "title": "Hour by hour",
        "body": "From registration and breakfast to the closing ceremony.",
        "x": 0.5,
        "y": 0.3509,
        "phoneY": 0.3681
      }
    ]
  },
  {
    "id": "day-home",
    "era": "day",
    "path": "/day",
    "live": true,
    "title": "The day site",
    "intro": "On the morning of 5 October, mmrchtu.tech opened on a different site, made for the hall.",
    "image": {
      "src": "/journey/day-home.webp",
      "width": 1280,
      "height": 4200
    },
    "phone": {
      "src": "/journey/day-home-phone.webp",
      "width": 780,
      "height": 8400
    },
    "notes": [
      {
        "title": "A new site overnight",
        "body": "Dark, big type, and live. Everything on it updated as the desks worked.",
        "x": 0.2628,
        "y": 0.0677,
        "phoneY": 0.0553
      },
      {
        "title": "Who's on the maze",
        "body": "On the maze, on deck and in the hole, on both mazes at once, with times.",
        "x": 0.1293,
        "y": 0.3052,
        "phoneY": 0.4111
      },
      {
        "title": "Six phases",
        "body": "Qualifying, then the round of 32 down to the final.",
        "x": 0.1694,
        "y": 0.4524,
        "phoneY": 0.5961
      },
      {
        "title": "How a place is earned",
        "body": "The scoring formula with a worked example, so nobody had to ask.",
        "x": 0.6817,
        "y": 0.5623,
        "phoneY": 0.9843
      },
      {
        "title": "Photos, live",
        "body": "Photos from the hall went up as they were taken.",
        "x": 0.073,
        "y": 0.8538,
        "phoneY": null
      }
    ]
  },
  {
    "id": "day-screen",
    "era": "day",
    "path": "/day/screen",
    "live": true,
    "title": "The hall screen",
    "intro": "The same queue, made for a projector on the wall.",
    "image": {
      "src": "/journey/day-screen.webp",
      "width": 1920,
      "height": 1080
    },
    "phone": null,
    "notes": [
      {
        "title": "On the maze",
        "body": "The team running now, its code, its maze and its place in the order.",
        "x": 0.3111,
        "y": 0.3402,
        "phoneY": null
      },
      {
        "title": "Next up",
        "body": "On deck and in the hole, so teams were at the staging table before they were called.",
        "x": 0.7971,
        "y": 0.2025,
        "phoneY": null
      },
      {
        "title": "And on every phone",
        "body": "The screen sent the hall to the site, which showed the same thing.",
        "x": 0.1293,
        "y": 0.959,
        "phoneY": null
      }
    ]
  },
  {
    "id": "day-standings",
    "era": "day",
    "path": "/day/standings",
    "live": true,
    "title": "The standings",
    "intro": "The qualifying table, every team on one page.",
    "image": {
      "src": "/journey/day-standings.webp",
      "width": 1280,
      "height": 4200
    },
    "phone": {
      "src": "/journey/day-standings-phone.webp",
      "width": 780,
      "height": 8400
    },
    "notes": [
      {
        "title": "Every team, one table",
        "body": "Runs, official time and score, filled in as the judges' tablets sent them.",
        "x": 0.2547,
        "y": 0.038,
        "phoneY": 0.0288
      },
      {
        "title": "The cut",
        "body": "The score to beat for the last place in the knockout.",
        "x": 0.8606,
        "y": 0.1366,
        "phoneY": 0.1634
      },
      {
        "title": "Held until announced",
        "body": "Scores stayed hidden until the organisers revealed them, then appeared everywhere at once.",
        "x": 0.211,
        "y": 0.1053,
        "phoneY": 0.0983
      }
    ]
  },
  {
    "id": "day-schedule",
    "era": "day",
    "path": "/day/schedule",
    "live": true,
    "title": "The running order",
    "intro": "The day's timetable, in Amman time.",
    "image": {
      "src": "/journey/day-schedule.webp",
      "width": 1280,
      "height": 1660
    },
    "phone": {
      "src": "/journey/day-schedule-phone.webp",
      "width": 780,
      "height": 4568
    },
    "notes": [
      {
        "title": "The day, in order",
        "body": "What was on, when and where.",
        "x": 0.278,
        "y": 0.0961,
        "phoneY": 0.053
      },
      {
        "title": "Qualifying",
        "body": "Phase I ran on two mazes at once, two teams per slot.",
        "x": 0.5625,
        "y": 0.3721,
        "phoneY": 0.2722
      }
    ]
  },
  {
    "id": "day-competitors",
    "era": "day",
    "path": "/day/competitors",
    "live": true,
    "title": "For competitors",
    "intro": "A page for the teams: what happens to them, in order.",
    "image": {
      "src": "/journey/day-competitors.webp",
      "width": 1280,
      "height": 2255
    },
    "phone": {
      "src": "/journey/day-competitors-phone.webp",
      "width": 780,
      "height": 7754
    },
    "notes": [
      {
        "title": "Your day, step by step",
        "body": "Arrival, inspection, qualifying, the knockout.",
        "x": 0.3688,
        "y": 0.0886,
        "phoneY": 0.0364
      },
      {
        "title": "What to bring",
        "body": "So nobody found out at the table.",
        "x": 0.1196,
        "y": 0.5797,
        "phoneY": 0.4014
      }
    ]
  },
  {
    "id": "day-photos",
    "era": "day",
    "path": "/day/photos",
    "live": true,
    "title": "Photos",
    "intro": "Taken in the hall and put up as they came in.",
    "image": {
      "src": "/journey/day-photos.webp",
      "width": 1280,
      "height": 2762
    },
    "phone": {
      "src": "/journey/day-photos-phone.webp",
      "width": 780,
      "height": 7406
    },
    "notes": [
      {
        "title": "From the hall",
        "body": "Newest first, each one free to download at full size.",
        "x": 0.1861,
        "y": 0.0578,
        "phoneY": 0.0327
      }
    ]
  }
];
