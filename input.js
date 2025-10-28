/**
 * @typedef {'Mouse1' | 'Mouse2' | 'Mouse3'} MouseButton
 */

/**
 * Manages keyboard and mouse input events.
 */
export class InputManager {
    constructor() {
        /** @type {Set<string>} */
        this.keysPressed = new Set();
        /** @type {Object.<MouseButton, boolean>} */
        this.mouseButtonsPressed = {
            'Mouse1': false,
            'Mouse2': false,
            'Mouse3': false
        };
        /** @type {Object.<MouseButton, boolean>} */
        this.mouseButtonsClicked = {
            'Mouse1': false,
            'Mouse2': false,
            'Mouse3': false
        };
        /** @type {number} */
        this.mouseDeltaX = 0;
        /** @type {number} */
        this.mouseDeltaY = 0;
        /** @type {boolean} */
        this.pointerLocked = false;

        this.boundOnKeyDown = this.onKeyDown.bind(this);
        this.boundOnKeyUp = this.onKeyUp.bind(this);
        this.boundOnMouseDown = this.onMouseDown.bind(this);
        this.boundOnMouseUp = this.onMouseUp.bind(this);
        this.boundOnMouseMove = this.onMouseMove.bind(this);
        this.boundOnPointerLockChange = this.onPointerLockChange.bind(this);

        this.initEventListeners();
    }

    /**
     * Initializes all event listeners.
     */
    initEventListeners() {
        document.addEventListener('keydown', this.boundOnKeyDown, false);
        document.addEventListener('keyup', this.boundOnKeyUp, false);
        document.addEventListener('mousedown', this.boundOnMouseDown, false);
        document.addEventListener('mouseup', this.boundOnMouseUp, false);
        document.addEventListener('mousemove', this.boundOnMouseMove, false);
        document.addEventListener('pointerlockchange', this.boundOnPointerLockChange, false);
        document.addEventListener('mozpointerlockchange', this.boundOnPointerLockChange, false); // Firefox
        document.addEventListener('webkitpointerlockchange', this.boundOnPointerLockChange, false); // Chrome/Safari
    }

    /**
     * Removes all event listeners.
     */
    dispose() {
        document.removeEventListener('keydown', this.boundOnKeyDown, false);
        document.removeEventListener('keyup', this.boundOnKeyUp, false);
        document.removeEventListener('mousedown', this.boundOnMouseDown, false);
        document.removeEventListener('mouseup', this.boundOnMouseUp, false);
        document.removeEventListener('mousemove', this.boundOnMouseMove, false);
        document.removeEventListener('pointerlockchange', this.boundOnPointerLockChange, false);
        document.removeEventListener('mozpointerlockchange', this.boundOnPointerLockChange, false);
        document.removeEventListener('webkitpointerlockchange', this.boundOnPointerLockChange, false);
    }

    /**
     * Handles keydown events.
     * @param {KeyboardEvent} event
     */
    onKeyDown(event) {
        this.keysPressed.add(event.code);
    }

    /**
     * Handles keyup events.
     * @param {KeyboardEvent} event
     */
    onKeyUp(event) {
        this.keysPressed.delete(event.code);
    }

    /**
     * Handles mousedown events.
     * @param {MouseEvent} event
     */
    onMouseDown(event) {
        if (!this.pointerLocked) return; // Ignore clicks if pointer not locked

        switch (event.button) {
            case 0: this.mouseButtonsPressed['Mouse1'] = true; this.mouseButtonsClicked['Mouse1'] = true; break;
            case 1: this.mouseButtonsPressed['Mouse3'] = true; this.mouseButtonsClicked['Mouse3'] = true; break;
            case 2: this.mouseButtonsPressed['Mouse2'] = true; this.mouseButtonsClicked['Mouse2'] = true; break;
        }
    }

    /**
     * Handles mouseup events.
     * @param {MouseEvent} event
     */
    onMouseUp(event) {
        switch (event.button) {
            case 0: this.mouseButtonsPressed['Mouse1'] = false; break;
            case 1: this.mouseButtonsPressed['Mouse3'] = false; break;
            case 2: this.mouseButtonsPressed['Mouse2'] = false; break;
        }
    }

    /**
     * Handles mousemove events.
     * @param {MouseEvent} event
     */
    onMouseMove(event) {
        if (!this.pointerLocked) return;

        this.mouseDeltaX += event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        this.mouseDeltaY += event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    }

    /**
     * Handles pointer lock change events.
     */
    onPointerLockChange() {
        this.pointerLocked = (document.pointerLockElement !== null ||
                              document.mozPointerLockElement !== null ||
                              document.webkitPointerLockElement !== null);
        if (!this.pointerLocked) {
            // Reset input states when pointer lock is lost
            this.keysPressed.clear();
            this.mouseButtonsPressed['Mouse1'] = false;
            this.mouseButtonsPressed['Mouse2'] = false;
            this.mouseButtonsPressed['Mouse3'] = false;
            this.mouseButtonsClicked['Mouse1'] = false;
            this.mouseButtonsClicked['Mouse2'] = false;
            this.mouseButtonsClicked['Mouse3'] = false;
            this.mouseDeltaX = 0;
            this.mouseDeltaY = 0;
        }
    }

    /**
     * Checks if a specific key is currently pressed.
     * @param {string} key - The `event.code` of the key (e.g., 'KeyW', 'Space').
     * @returns {boolean} True if the key is pressed, false otherwise.
     */
    isKeyPressed(key) {
        return this.keysPressed.has(key);
    }

    /**
     * Returns the accumulated mouse movement in X direction for the current frame.
     * @returns {number}
     */
    getMouseDeltaX() {
        return this.mouseDeltaX;
    }

    /**
     * Returns the accumulated mouse movement in Y direction for the current frame.
     * @returns {number}
     */
    getMouseDeltaY() {
        return this.mouseDeltaY;
    }

    /**
     * Checks if a specific mouse button was clicked (pressed and released) in the current frame.
     * This method also resets the clicked state after checking.
     * @param {MouseButton} button - The mouse button ('Mouse1', 'Mouse2', 'Mouse3').
     * @returns {boolean} True if the button was clicked, false otherwise.
     */
    getMouseButtonClicked(button) {
        if (this.mouseButtonsClicked[button]) {
            this.mouseButtonsClicked[button] = false; // Reset after checking
            return true;
        }
        return false;
    }

    /**
     * Checks if a specific mouse button is currently held down.
     * @param {MouseButton} button - The mouse button ('Mouse1', 'Mouse2', 'Mouse3').
     * @returns {boolean} True if the button is pressed, false otherwise.
     */
    isMouseButtonPressed(button) {
        return this.mouseButtonsPressed[button];
    }

    /**
     * Resets mouse delta values for the next frame.
     * Should be called at the end of each game loop iteration.
     */
    resetMouseDelta() {
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
    }

    /**
     * Requests pointer lock on the given element.
     * @param {HTMLElement} element - The element to lock the pointer to.
     */
    requestPointerLock(element) {
        element.requestPointerLock = element.requestPointerLock ||
                                     element.mozRequestPointerLock ||
                                     element.webkitRequestPointerLock;
        if (element.requestPointerLock) {
            element.requestPointerLock();
        } else {
            console.warn("Pointer Lock API not supported by this browser.");
        }
    }
}
