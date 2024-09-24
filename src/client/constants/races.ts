import classes from '../../client/components/Table/Table.module.css'

import z from '../../client/assets/zerg.svg'
import t from '../../client/assets/terran.svg'
import p from '../../client/assets/protoss.svg'
import r from '../../client/assets/random.svg'

export const raceAssets = {
    ZERG: { className: classes.zerg, assetPath: z },
    TERRAN: { className: classes.terran, assetPath: t },
    PROTOSS: { className: classes.protoss, assetPath: p },
    RANDOM: { className: classes.random, assetPath: r },
};