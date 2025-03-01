/**
 * @module 3D
 * @submodule Interaction
 * @for p5
 * @requires core
 */

import p5 from '../core/main';
import * as constants from '../core/constants';

/**
 * Allows movement around a 3D sketch using a mouse or trackpad or touch.
 * Left-clicking and dragging or swipe motion will rotate the camera position
 * about the center of the sketch, right-clicking and dragging or multi-swipe
 * will pan the camera position without rotation, and using the mouse wheel
 * (scrolling) or pinch in/out will move the camera further or closer
 * from the center of the sketch. This function can be called with parameters
 * dictating sensitivity to mouse/touch movement along the X and Y axes.
 * Calling this function without parameters is equivalent to calling
 * orbitControl(1,1). To reverse direction of movement in either axis,
 * enter a negative number for sensitivity.
 * @method orbitControl
 * @for p5
 * @param  {Number} [sensitivityX] sensitivity to mouse movement along X axis
 * @param  {Number} [sensitivityY] sensitivity to mouse movement along Y axis
 * @param  {Number} [sensitivityZ] sensitivity to scroll movement along Z axis
 * @param  {Object} [options] An optional object that can contain additional settings,
 * disableTouchActions - Boolean, default value is true.
 * Setting this to true makes mobile interactions smoother by preventing
 * accidental interactions with the page while orbiting. But if you're already
 * doing it via css or want the default touch actions, consider setting it to false.
 * @chainable
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(100, 100, WEBGL);
 *   normalMaterial();
 *   describe(
 *     'Camera orbits around a box when mouse is hold-clicked & then moved.'
 *   );
 * }
 * function draw() {
 *   background(200);
 *   orbitControl();
 *   rotateY(0.5);
 *   box(30, 50);
 * }
 * </code>
 * </div>
 *
 * @alt
 * Camera orbits around a box when mouse is hold-clicked & then moved.
 */

// implementation based on three.js 'orbitControls':
// https://github.com/mrdoob/three.js/blob/dev/examples/js/controls/OrbitControls.js
p5.prototype.orbitControl = function(
  sensitivityX,
  sensitivityY,
  sensitivityZ,
  options
) {
  this._assert3d('orbitControl');
  p5._validateParameters('orbitControl', arguments);

  // If the mouse is not in bounds of the canvas, disable all behaviors:
  const mouseInCanvas =
    this.mouseX < this.width &&
    this.mouseX > 0 &&
    this.mouseY < this.height &&
    this.mouseY > 0;
  if (!mouseInCanvas) return;

  const cam = this._renderer._curCamera;

  if (typeof sensitivityX === 'undefined') {
    sensitivityX = 1;
  }
  if (typeof sensitivityY === 'undefined') {
    sensitivityY = sensitivityX;
  }
  if (typeof sensitivityZ === 'undefined') {
    sensitivityZ = 1;
  }
  if (typeof options !== 'object') {
    options = {};
  }

  // default right-mouse and mouse-wheel behaviors (context menu and scrolling,
  // respectively) are disabled here to allow use of those events for panning and
  // zooming. However, whether or not to disable touch actions is an option.

  // disable context menu for canvas element and add 'contextMenuDisabled'
  // flag to p5 instance
  if (this.contextMenuDisabled !== true) {
    this.canvas.oncontextmenu = () => false;
    this._setProperty('contextMenuDisabled', true);
  }

  // disable default scrolling behavior on the canvas element and add
  // 'wheelDefaultDisabled' flag to p5 instance
  if (this.wheelDefaultDisabled !== true) {
    this.canvas.onwheel = () => false;
    this._setProperty('wheelDefaultDisabled', true);
  }

  // disable default touch behavior on the canvas element and add
  // 'touchActionsDisabled' flag to p5 instance
  const { disableTouchActions = true } = options;
  if (this.touchActionsDisabled !== true && disableTouchActions) {
    this.canvas.style['touch-action'] = 'none';
    this._setProperty('touchActionsDisabled', true);
  }

  // get moved touches.
  const movedTouches = [];
  for (let i = 0; i < this.touches.length; i++) {
    const curTouch = this.touches[i];
    for (let k = 0; k < this._renderer.prevTouches.length; k++) {
      const prevTouch = this._renderer.prevTouches[k];
      if (curTouch.id === prevTouch.id) {
        const movedTouch = {
          x: curTouch.x,
          y: curTouch.y,
          px: prevTouch.x,
          py: prevTouch.y
        };
        movedTouches.push(movedTouch);
      }
    }
  }
  this._renderer.prevTouches = this.touches;

  // The idea of using damping is based on the following website. thank you.
  // https://github.com/freshfork/p5.EasyCam/blob/9782964680f6a5c4c9bee825c475d9f2021d5134/p5.easycam.js#L1124

  // variables for interaction
  let deltaRadius = 0;
  let deltaTheta = 0;
  let deltaPhi = 0;
  let moveDeltaX = 0;
  let moveDeltaY = 0;
  // constants for dampingProcess
  const damping = 0.85;
  const rotateAccelerationFactor = 0.6;
  const moveAccelerationFactor = 0.15;
  // For touches, the appropriate scale is different
  // because the distance difference is multiplied.
  const mouseZoomScaleFactor = 0.0001;
  const touchZoomScaleFactor = 0.0004;
  const scaleFactor = this.height < this.width ? this.height : this.width;

  // calculate and determine flags and variables.
  if (movedTouches.length > 0) {
    /* for touch */
    // if length === 1, rotate
    // if length > 1, zoom and move
    if (movedTouches.length === 1) {
      const t = movedTouches[0];
      deltaTheta = -sensitivityX * (t.x - t.px) / scaleFactor;
      deltaPhi = sensitivityY * (t.y - t.py) / scaleFactor;
    } else {
      const t0 = movedTouches[0];
      const t1 = movedTouches[1];
      const distWithTouches = Math.hypot(t0.x - t1.x, t0.y - t1.y);
      const prevDistWithTouches = Math.hypot(t0.px - t1.px, t0.py - t1.py);
      const changeDist = distWithTouches - prevDistWithTouches;
      // move the camera farther when the distance between the two touch points
      // decreases, move the camera closer when it increases.
      deltaRadius = -changeDist * sensitivityZ * touchZoomScaleFactor;
      // Move the center of the camera along with the movement of
      // the center of gravity of the two touch points.
      moveDeltaX = 0.5 * (t0.x + t1.x) - 0.5 * (t0.px + t1.px);
      moveDeltaY = 0.5 * (t0.y + t1.y) - 0.5 * (t0.py + t1.py);
    }
  } else {
    /* for mouse */
    // if wheelDeltaY !== 0, zoom
    // if mouseLeftButton is down, rotate
    // if mouseRightButton is down, move
    if (this._mouseWheelDeltaY !== 0) {
      // zoom the camera depending on the value of _mouseWheelDeltaY.
      // move away if positive, move closer if negative
      deltaRadius = this._mouseWheelDeltaY * sensitivityZ;
      deltaRadius *= mouseZoomScaleFactor;
      this._mouseWheelDeltaY = 0;
    }
    if (this.mouseIsPressed) {
      if (this.mouseButton === this.LEFT) {
        deltaTheta = -sensitivityX * (this.mouseX - this.pmouseX) / scaleFactor;
        deltaPhi = sensitivityY * (this.mouseY - this.pmouseY) / scaleFactor;
      } else if (this.mouseButton === this.RIGHT) {
        moveDeltaX = this.mouseX - this.pmouseX;
        moveDeltaY = this.mouseY - this.pmouseY;
      }
    }
  }

  // interactions

  // zoom process
  if (deltaRadius !== 0) {
    // accelerate zoom velocity
    this._renderer.zoomVelocity += deltaRadius;
  }
  if (Math.abs(this._renderer.zoomVelocity) > 0.001) {
    this._renderer._curCamera._orbit(0, 0, this._renderer.zoomVelocity);
    // In orthogonal projection, the scale does not change even if
    // the distance to the gaze point is changed, so the projection matrix
    // needs to be modified.
    if (this._renderer.uPMatrix.mat4[15] !== 0) {
      this._renderer.uPMatrix.mat4[0] *= Math.pow(
        10, -this._renderer.zoomVelocity
      );
      this._renderer.uPMatrix.mat4[5] *= Math.pow(
        10, -this._renderer.zoomVelocity
      );
    }
    // damping
    this._renderer.zoomVelocity *= damping;
  } else {
    this._renderer.zoomVelocity = 0;
  }

  // rotate process
  if (deltaTheta !== 0 || deltaPhi !== 0) {
    // accelerate rotate velocity
    this._renderer.rotateVelocity.add(
      deltaTheta * rotateAccelerationFactor,
      deltaPhi * rotateAccelerationFactor,
      0
    );
  }
  if (this._renderer.rotateVelocity.mag() > 0.001) {
    this._renderer._curCamera._orbit(
      this._renderer.rotateVelocity.x,
      this._renderer.rotateVelocity.y,
      0
    );
    // damping
    this._renderer.rotateVelocity.mult(damping);
  } else {
    this._renderer.rotateVelocity.set(0, 0);
  }

  // move process
  if (moveDeltaX !== 0 || moveDeltaY !== 0) {
    // Normalize movement distance
    const ndcX = moveDeltaX * 2/this.width;
    const ndcY = -moveDeltaY * 2/this.height;
    // accelerate move velocity
    this._renderer.moveVelocity.add(
      ndcX * moveAccelerationFactor,
      ndcY * moveAccelerationFactor
    );
  }
  if (this._renderer.moveVelocity.mag() > 0.001) {
    // Translate the camera so that the entire object moves
    // perpendicular to the line of sight when the mouse is moved
    // or when the centers of gravity of the two touch pointers move.
    var local = cam._getLocalAxes();

    // Calculate the z coordinate in the view coordinates of
    // the center, that is, the distance to the view point
    const diffX = cam.eyeX - cam.centerX;
    const diffY = cam.eyeY - cam.centerY;
    const diffZ = cam.eyeZ - cam.centerZ;
    const viewZ = Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ);

    // position vector of the center.
    let cv = new p5.Vector(cam.centerX, cam.centerY, cam.centerZ);

    // Calculate the normalized device coordinates of the center.
    cv = cam.cameraMatrix.multiplyPoint(cv);
    cv = this._renderer.uPMatrix.multiplyAndNormalizePoint(cv);

    // Move the center by this distance
    // in the normalized device coordinate system.
    cv.x -= this._renderer.moveVelocity.x;
    cv.y -= this._renderer.moveVelocity.y;

    // Calculate the translation vector
    // in the direction perpendicular to the line of sight of center.
    let dx, dy;
    const uP = this._renderer.uPMatrix.mat4;

    if (uP[15] === 0) {
      dx = ((uP[8] + cv.x)/uP[0]) * viewZ;
      dy = ((uP[9] + cv.y)/uP[5]) * viewZ;
    } else {
      dx = (cv.x - uP[12])/uP[0];
      dy = (cv.y - uP[13])/uP[5];
    }

    // translate the camera.
    cam.setPosition(
      cam.eyeX + dx * local.x[0] + dy * local.y[0],
      cam.eyeY + dx * local.x[1] + dy * local.y[1],
      cam.eyeZ + dx * local.x[2] + dy * local.y[2]
    );
    // damping
    this._renderer.moveVelocity.mult(damping);
  } else {
    this._renderer.moveVelocity.set(0, 0);
  }

  return this;
};


/**
 * debugMode() helps visualize 3D space by adding a grid to indicate where the
 * ‘ground’ is in a sketch and an axes icon which indicates the +X, +Y, and +Z
 * directions. This function can be called without parameters to create a
 * default grid and axes icon, or it can be called according to the examples
 * above to customize the size and position of the grid and/or axes icon.  The
 * grid is drawn using the most recently set stroke color and weight.  To
 * specify these parameters, add a call to stroke() and strokeWeight()
 * just before the end of the draw() loop.
 *
 * By default, the grid will run through the origin (0,0,0) of the sketch
 * along the XZ plane
 * and the axes icon will be offset from the origin.  Both the grid and axes
 * icon will be sized according to the current canvas size.  Note that because the
 * grid runs parallel to the default camera view, it is often helpful to use
 * debugMode along with orbitControl to allow full view of the grid.
 * @method debugMode
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(100, 100, WEBGL);
 *   camera(0, -30, 100, 0, 0, 0, 0, 1, 0);
 *   normalMaterial();
 *   debugMode();
 *   describe(
 *     'a 3D box is centered on a grid in a 3D sketch. an icon indicates the direction of each axis: a red line points +X, a green line +Y, and a blue line +Z. the grid and icon disappear when the spacebar is pressed.'
 *   );
 * }
 *
 * function draw() {
 *   background(200);
 *   orbitControl();
 *   box(15, 30);
 *   // Press the spacebar to turn debugMode off!
 *   if (keyIsDown(32)) {
 *     noDebugMode();
 *   }
 * }
 * </code>
 * </div>
 * @alt
 * a 3D box is centered on a grid in a 3D sketch. an icon
 * indicates the direction of each axis: a red line points +X,
 * a green line +Y, and a blue line +Z. the grid and icon disappear when the
 * spacebar is pressed.
 *
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(100, 100, WEBGL);
 *   camera(0, -30, 100, 0, 0, 0, 0, 1, 0);
 *   normalMaterial();
 *   debugMode(GRID);
 *   describe('a 3D box is centered on a grid in a 3D sketch.');
 * }
 *
 * function draw() {
 *   background(200);
 *   orbitControl();
 *   box(15, 30);
 * }
 * </code>
 * </div>
 * @alt
 * a 3D box is centered on a grid in a 3D sketch.
 *
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(100, 100, WEBGL);
 *   camera(0, -30, 100, 0, 0, 0, 0, 1, 0);
 *   normalMaterial();
 *   debugMode(AXES);
 *   describe(
 *     'a 3D box is centered in a 3D sketch. an icon indicates the direction of each axis: a red line points +X, a green line +Y, and a blue line +Z.'
 *   );
 * }
 *
 * function draw() {
 *   background(200);
 *   orbitControl();
 *   box(15, 30);
 * }
 * </code>
 * </div>
 * @alt
 * a 3D box is centered in a 3D sketch. an icon
 * indicates the direction of each axis: a red line points +X,
 * a green line +Y, and a blue line +Z.
 *
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(100, 100, WEBGL);
 *   camera(0, -30, 100, 0, 0, 0, 0, 1, 0);
 *   normalMaterial();
 *   debugMode(GRID, 100, 10, 0, 0, 0);
 *   describe('a 3D box is centered on a grid in a 3D sketch');
 * }
 *
 * function draw() {
 *   background(200);
 *   orbitControl();
 *   box(15, 30);
 * }
 * </code>
 * </div>
 * @alt
 * a 3D box is centered on a grid in a 3D sketch
 *
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(100, 100, WEBGL);
 *   camera(0, -30, 100, 0, 0, 0, 0, 1, 0);
 *   normalMaterial();
 *   debugMode(100, 10, 0, 0, 0, 20, 0, -40, 0);
 *   describe(
 *     'a 3D box is centered on a grid in a 3D sketch. an icon indicates the direction of each axis: a red line points +X, a green line +Y, and a blue line +Z.'
 *   );
 * }
 *
 * function draw() {
 *   noStroke();
 *   background(200);
 *   orbitControl();
 *   box(15, 30);
 *   // set the stroke color and weight for the grid!
 *   stroke(255, 0, 150);
 *   strokeWeight(0.8);
 * }
 * </code>
 * </div>
 * @alt
 * a 3D box is centered on a grid in a 3D sketch. an icon
 * indicates the direction of each axis: a red line points +X,
 * a green line +Y, and a blue line +Z.
 */

/**
 * @method debugMode
 * @param {Constant} mode either GRID or AXES
 */

/**
 * @method debugMode
 * @param {Constant} mode
 * @param {Number} [gridSize] size of one side of the grid
 * @param {Number} [gridDivisions] number of divisions in the grid
 * @param {Number} [xOff] X axis offset from origin (0,0,0)
 * @param {Number} [yOff] Y axis offset from origin (0,0,0)
 * @param {Number} [zOff] Z axis offset from origin (0,0,0)
 */

/**
 * @method debugMode
 * @param {Constant} mode
 * @param {Number} [axesSize] size of axes icon
 * @param {Number} [xOff]
 * @param {Number} [yOff]
 * @param {Number} [zOff]
 */

/**
 * @method debugMode
 * @param {Number} [gridSize]
 * @param {Number} [gridDivisions]
 * @param {Number} [gridXOff]
 * @param {Number} [gridYOff]
 * @param {Number} [gridZOff]
 * @param {Number} [axesSize]
 * @param {Number} [axesXOff]
 * @param {Number} [axesYOff]
 * @param {Number} [axesZOff]
 */

p5.prototype.debugMode = function(...args) {
  this._assert3d('debugMode');
  p5._validateParameters('debugMode', args);

  // start by removing existing 'post' registered debug methods
  for (let i = this._registeredMethods.post.length - 1; i >= 0; i--) {
    // test for equality...
    if (
      this._registeredMethods.post[i].toString() === this._grid().toString() ||
      this._registeredMethods.post[i].toString() === this._axesIcon().toString()
    ) {
      this._registeredMethods.post.splice(i, 1);
    }
  }

  // then add new debugMode functions according to the argument list
  if (args[0] === constants.GRID) {
    this.registerMethod(
      'post',
      this._grid.call(this, args[1], args[2], args[3], args[4], args[5])
    );
  } else if (args[0] === constants.AXES) {
    this.registerMethod(
      'post',
      this._axesIcon.call(this, args[1], args[2], args[3], args[4])
    );
  } else {
    this.registerMethod(
      'post',
      this._grid.call(this, args[0], args[1], args[2], args[3], args[4])
    );
    this.registerMethod(
      'post',
      this._axesIcon.call(this, args[5], args[6], args[7], args[8])
    );
  }
};

/**
 * Turns off debugMode() in a 3D sketch.
 * @method noDebugMode
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(100, 100, WEBGL);
 *   camera(0, -30, 100, 0, 0, 0, 0, 1, 0);
 *   normalMaterial();
 *   debugMode();
 *   describe(
 *     'a 3D box is centered on a grid in a 3D sketch. an icon indicates the direction of each axis: a red line points +X, a green line +Y, and a blue line +Z. the grid and icon disappear when the spacebar is pressed.'
 *   );
 * }
 *
 * function draw() {
 *   background(200);
 *   orbitControl();
 *   box(15, 30);
 *   // Press the spacebar to turn debugMode off!
 *   if (keyIsDown(32)) {
 *     noDebugMode();
 *   }
 * }
 * </code>
 * </div>
 * @alt
 * a 3D box is centered on a grid in a 3D sketch. an icon
 * indicates the direction of each axis: a red line points +X,
 * a green line +Y, and a blue line +Z. the grid and icon disappear when the
 * spacebar is pressed.
 */
p5.prototype.noDebugMode = function() {
  this._assert3d('noDebugMode');

  // start by removing existing 'post' registered debug methods
  for (let i = this._registeredMethods.post.length - 1; i >= 0; i--) {
    // test for equality...
    if (
      this._registeredMethods.post[i].toString() === this._grid().toString() ||
      this._registeredMethods.post[i].toString() === this._axesIcon().toString()
    ) {
      this._registeredMethods.post.splice(i, 1);
    }
  }
};

/**
 * For use with debugMode
 * @private
 * @method _grid
 * @param {Number} [size] size of grid sides
 * @param {Number} [div] number of grid divisions
 * @param {Number} [xOff] offset of grid center from origin in X axis
 * @param {Number} [yOff] offset of grid center from origin in Y axis
 * @param {Number} [zOff] offset of grid center from origin in Z axis
 */
p5.prototype._grid = function(size, numDivs, xOff, yOff, zOff) {
  if (typeof size === 'undefined') {
    size = this.width / 2;
  }
  if (typeof numDivs === 'undefined') {
    // ensure at least 2 divisions
    numDivs = Math.round(size / 30) < 4 ? 4 : Math.round(size / 30);
  }
  if (typeof xOff === 'undefined') {
    xOff = 0;
  }
  if (typeof yOff === 'undefined') {
    yOff = 0;
  }
  if (typeof zOff === 'undefined') {
    zOff = 0;
  }

  const spacing = size / numDivs;
  const halfSize = size / 2;

  return function() {
    this.push();
    this.stroke(
      this._renderer.curStrokeColor[0] * 255,
      this._renderer.curStrokeColor[1] * 255,
      this._renderer.curStrokeColor[2] * 255
    );
    this._renderer.uMVMatrix.set(
      this._renderer._curCamera.cameraMatrix.mat4[0],
      this._renderer._curCamera.cameraMatrix.mat4[1],
      this._renderer._curCamera.cameraMatrix.mat4[2],
      this._renderer._curCamera.cameraMatrix.mat4[3],
      this._renderer._curCamera.cameraMatrix.mat4[4],
      this._renderer._curCamera.cameraMatrix.mat4[5],
      this._renderer._curCamera.cameraMatrix.mat4[6],
      this._renderer._curCamera.cameraMatrix.mat4[7],
      this._renderer._curCamera.cameraMatrix.mat4[8],
      this._renderer._curCamera.cameraMatrix.mat4[9],
      this._renderer._curCamera.cameraMatrix.mat4[10],
      this._renderer._curCamera.cameraMatrix.mat4[11],
      this._renderer._curCamera.cameraMatrix.mat4[12],
      this._renderer._curCamera.cameraMatrix.mat4[13],
      this._renderer._curCamera.cameraMatrix.mat4[14],
      this._renderer._curCamera.cameraMatrix.mat4[15]
    );

    // Lines along X axis
    for (let q = 0; q <= numDivs; q++) {
      this.beginShape(this.LINES);
      this.vertex(-halfSize + xOff, yOff, q * spacing - halfSize + zOff);
      this.vertex(+halfSize + xOff, yOff, q * spacing - halfSize + zOff);
      this.endShape();
    }

    // Lines along Z axis
    for (let i = 0; i <= numDivs; i++) {
      this.beginShape(this.LINES);
      this.vertex(i * spacing - halfSize + xOff, yOff, -halfSize + zOff);
      this.vertex(i * spacing - halfSize + xOff, yOff, +halfSize + zOff);
      this.endShape();
    }

    this.pop();
  };
};

/**
 * For use with debugMode
 * @private
 * @method _axesIcon
 * @param {Number} [size] size of axes icon lines
 * @param {Number} [xOff] offset of icon from origin in X axis
 * @param {Number} [yOff] offset of icon from origin in Y axis
 * @param {Number} [zOff] offset of icon from origin in Z axis
 */
p5.prototype._axesIcon = function(size, xOff, yOff, zOff) {
  if (typeof size === 'undefined') {
    size = this.width / 20 > 40 ? this.width / 20 : 40;
  }
  if (typeof xOff === 'undefined') {
    xOff = -this.width / 4;
  }
  if (typeof yOff === 'undefined') {
    yOff = xOff;
  }
  if (typeof zOff === 'undefined') {
    zOff = xOff;
  }

  return function() {
    this.push();
    this._renderer.uMVMatrix.set(
      this._renderer._curCamera.cameraMatrix.mat4[0],
      this._renderer._curCamera.cameraMatrix.mat4[1],
      this._renderer._curCamera.cameraMatrix.mat4[2],
      this._renderer._curCamera.cameraMatrix.mat4[3],
      this._renderer._curCamera.cameraMatrix.mat4[4],
      this._renderer._curCamera.cameraMatrix.mat4[5],
      this._renderer._curCamera.cameraMatrix.mat4[6],
      this._renderer._curCamera.cameraMatrix.mat4[7],
      this._renderer._curCamera.cameraMatrix.mat4[8],
      this._renderer._curCamera.cameraMatrix.mat4[9],
      this._renderer._curCamera.cameraMatrix.mat4[10],
      this._renderer._curCamera.cameraMatrix.mat4[11],
      this._renderer._curCamera.cameraMatrix.mat4[12],
      this._renderer._curCamera.cameraMatrix.mat4[13],
      this._renderer._curCamera.cameraMatrix.mat4[14],
      this._renderer._curCamera.cameraMatrix.mat4[15]
    );

    // X axis
    this.strokeWeight(2);
    this.stroke(255, 0, 0);
    this.beginShape(this.LINES);
    this.vertex(xOff, yOff, zOff);
    this.vertex(xOff + size, yOff, zOff);
    this.endShape();
    // Y axis
    this.stroke(0, 255, 0);
    this.beginShape(this.LINES);
    this.vertex(xOff, yOff, zOff);
    this.vertex(xOff, yOff + size, zOff);
    this.endShape();
    // Z axis
    this.stroke(0, 0, 255);
    this.beginShape(this.LINES);
    this.vertex(xOff, yOff, zOff);
    this.vertex(xOff, yOff, zOff + size);
    this.endShape();
    this.pop();
  };
};

export default p5;
