import type { IslandDef } from '../layout'
import { ChronoRebellion } from './Chrono'
import { MergeDefence } from './Merge'
import { BehindTheSmile } from './Smile'
import { SunkenGreed } from './Sunken'
import { PaperPlaneDash } from './Dash'
import { Harbor } from './Harbor'
import { Workshop } from './Workshop'
import { Journey } from './Journey'

/**
 * One small diorama per island, each about what the project (or section) is:
 * built in code from simple shapes, one Lambert mesh plus a few glowing / animated parts each.
 */

/* ---------------- router ---------------- */

export function IslandLandmark({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  switch (def.id) {
    case 'behind-the-smile':
      return <BehindTheSmile def={def} night={night} simple={simple} />
    case 'chrono-rebellion':
      return <ChronoRebellion def={def} night={night} simple={simple} />
    case 'sunken-greed':
      return <SunkenGreed def={def} night={night} simple={simple} />
    case 'paper-plane-dash':
      return <PaperPlaneDash def={def} night={night} simple={simple} />
    case 'merge-defence':
      return <MergeDefence def={def} night={night} simple={simple} />
    case 'harbor':
      return <Harbor def={def} night={night} simple={simple} />
    case 'workshop':
      return <Workshop def={def} night={night} simple={simple} />
    case 'journey':
      return <Journey def={def} night={night} simple={simple} />
    default:
      return null
  }
}
