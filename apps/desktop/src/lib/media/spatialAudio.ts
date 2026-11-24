/**
 * Spatial Audio Engine for Echo Voice Channels.
 *
 * Positions remote participants in 3D space using Web Audio PannerNode.
 * Each peer gets a position based on their index in the participant list,
 * arranged in a semicircle in front of the listener.
 */

export interface SpatialPosition {
 x: number;
 y: number;
 z: number;
}

const SPATIAL_RADIUS = 3;
const MAX_ANGLE = Math.PI / 2.5;

export function computeSpatialPosition(index: number, total: number): SpatialPosition {
 if (total <= 1) return { x: 0, y: 0, z: -SPATIAL_RADIUS };

 const normalized = index / (total - 1);
 const angle = -MAX_ANGLE + normalized * 2 * MAX_ANGLE;

 return {
 x: Math.sin(angle) * SPATIAL_RADIUS,
 y: 0,
 z: -Math.cos(angle) * SPATIAL_RADIUS,
 };
}

export function applySpatialPanner(
 ctx: AudioContext,
 source: AudioNode,
 destination: AudioNode,
 position: SpatialPosition,
): StereoPannerNode | PannerNode {
 if (typeof ctx.createStereoPanner === "function") {
 const panner = ctx.createStereoPanner();
 const maxPan = 0.8;
 const pan = Math.max(-maxPan, Math.min(maxPan, position.x / SPATIAL_RADIUS));
 panner.pan.value = pan;
 source.connect(panner);
 panner.connect(destination);
 return panner;
 }

 const panner = ctx.createPanner();
 panner.panningModel = "HRTF";
 panner.distanceModel = "inverse";
 panner.refDistance = 1;
 panner.maxDistance = 10;
 panner.rolloffFactor = 1;
 panner.positionX.value = position.x;
 panner.positionY.value = position.y;
 panner.positionZ.value = position.z;
 source.connect(panner);
 panner.connect(destination);
 return panner;
}

export function updatePannerPosition(
 panner: StereoPannerNode | PannerNode,
 position: SpatialPosition,
): void {
 if ("pan" in panner) {
 const maxPan = 0.8;
 (panner as StereoPannerNode).pan.value = Math.max(-maxPan, Math.min(maxPan, position.x / SPATIAL_RADIUS));
 } else {
 const p = panner as PannerNode;
 p.positionX.value = position.x;
 p.positionY.value = position.y;
 p.positionZ.value = position.z;
 }
}