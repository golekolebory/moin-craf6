/**
 * @typedef {import("three")} THREE
 */

/**
 * Manages the Three.js scene, camera, and WebGL renderer.
 */
export class Renderer {
    constructor() {
        /** @type {THREE.Scene} */
        this.scene = new THREE.Scene();
        /** @type {THREE.PerspectiveCamera} */
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        /** @type {THREE.WebGLRenderer | null} */
        this.renderer = null;
        /** @type {THREE.AmbientLight | null} */
        this.ambientLight = null;
        /** @type {THREE.DirectionalLight | null} */
        this.directionalLight = null;
        /** @type {THREE.AudioListener | null} */
        this.audioListener = null;

        // Set a background color for the sky
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 1, 200); // Add some fog
    }

    /**
     * Initializes the renderer and attaches it to the given canvas element.
     * @param {HTMLCanvasElement} canvasElement - The canvas element to render to.
     */
    init(canvasElement) {
        if (!canvasElement) {
            console.error('Renderer: Canvas element not provided.');
            return;
        }

        this.renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true; // Enable shadows if needed later

        // Add lighting
        this.ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.directionalLight.position.set(50, 200, 100);
        this.directionalLight.castShadow = true;
        this.scene.add(this.directionalLight);

        // Add audio listener to the camera
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.onWindowResize(); // Initial resize call
    }

    /**
     * Handles window resize events to update camera aspect ratio and renderer size.
     */
    onWindowResize() {
        if (this.renderer && this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    /**
     * Renders the scene from the perspective of the camera.
     * @param {THREE.Scene} scene - The Three.js scene to render.
     * @param {THREE.PerspectiveCamera} camera - The camera to render from.
     */
    render(scene, camera) {
        if (!this.renderer) {
            console.error('Renderer: Renderer not initialized.');
            return;
        }
        this.renderer.render(scene, camera);
    }

    /**
     * Adds a Three.js object to the scene.
     * @param {THREE.Object3D} object - The object to add.
     */
    add(object) {
        this.scene.add(object);
    }

    /**
     * Removes a Three.js object from the scene.
     * @param {THREE.Object3D} object - The object to remove.
     */
    remove(object) {
        this.scene.remove(object);
    }

    /**
     * Updates the camera's projection matrix with a new aspect ratio.
     * @param {number} aspectRatio - The new aspect ratio (width / height).
     */
    updateProjection(aspectRatio) {
        if (this.camera) {
            this.camera.aspect = aspectRatio;
            this.camera.updateProjectionMatrix();
        }
    }

    /**
     * Returns the main camera used by the renderer.
     * @returns {THREE.PerspectiveCamera}
     */
    getCamera() {
        return this.camera;
    }

    /**
     * Returns the audio listener attached to the camera.
     * @returns {THREE.AudioListener}
     */
    getAudioListener() {
        return this.audioListener;
    }
}
