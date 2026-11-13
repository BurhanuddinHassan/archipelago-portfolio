import * as THREE from 'three'

/**
 * Where the Pilot is right now (world space), written by the rig every frame.
 * Island residents read it: e.g. the patrol soldier on Chrono Rebellion uses it for line of sight.
 */
export const player = { pos: new THREE.Vector3(), grounded: false, running: false }
