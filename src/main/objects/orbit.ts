export class Orbit implements IOrbit {
    readonly semiMajorAxis!:    number;
    readonly apoapsis?:         number;
    readonly periapsis?:        number;
    readonly eccentricity!:     number;
    readonly inclination!:      number;
    readonly argOfPeriapsis!:   number;
    readonly ascNodeLongitude!: number;
    //readonly sideralPeriod?:    number;
    readonly orbitalParam!:     number;
    readonly meanMotion!:       number;
    readonly ascNodeDir!:       THREE.Vector3;
    readonly periapsisDir!:     THREE.Vector3;
    readonly normal!:           THREE.Vector3;

    constructor(data: IOrbit, public readonly attractor: ICelestialBody, public readonly config: OrbitSettings, anglesToRad: boolean = true){
        this.semiMajorAxis = data.semiMajorAxis;
        this.eccentricity  = data.eccentricity;
        //this.sideralPeriod = data.sideralPeriod ? data.sideralPeriod : undefined;
        
        this.orbitalParam = this.semiMajorAxis * (1 - this.eccentricity**2);
        this.meanMotion = Math.sqrt(
            this.attractor.stdGravParam / (Math.abs(this.semiMajorAxis)**3)
        );

        if(this.eccentricity < 1) {
            this.periapsis = this.semiMajorAxis * (1 - this.eccentricity);
            this.apoapsis = 2 * this.semiMajorAxis - this.periapsis;
        }

        if(anglesToRad) {
            this.inclination      = THREE.MathUtils.degToRad(data.inclination);
            this.argOfPeriapsis   = THREE.MathUtils.degToRad(data.argOfPeriapsis);
            this.ascNodeLongitude = THREE.MathUtils.degToRad(data.ascNodeLongitude);
        } else {
            this.inclination      = data.inclination;
            this.argOfPeriapsis   = data.argOfPeriapsis;
            this.ascNodeLongitude = data.ascNodeLongitude;
        }

        // Calculate main direction vectors
        // with reference direction (1, 0, 0)
        this.ascNodeDir = new THREE.Vector3(1, 0, 0);
        this.ascNodeDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.ascNodeLongitude);
        this.normal = new THREE.Vector3(0, 1, 0);
        this.normal.applyAxisAngle(this.ascNodeDir, this.inclination);
        this.periapsisDir = this.ascNodeDir.clone();
        this.periapsisDir.applyAxisAngle(this.normal, this.argOfPeriapsis);
    }

    public get data(): IOrbit {
        return {
            semiMajorAxis:    this.semiMajorAxis,
            apoapsis:         this.apoapsis,
            periapsis:        this.periapsis,
            eccentricity:     this.eccentricity,
            inclination:      this.inclination,
            argOfPeriapsis:   this.argOfPeriapsis,
            ascNodeLongitude: this.ascNodeLongitude,
            //sideralPeriod:    this.sideralPeriod,
            orbitalParam:     this.orbitalParam,
            meanMotion:       this.meanMotion
        };
    }

    public static fromOrbitalElements(elements: OrbitalElements3D, attractor: ICelestialBody, config: OrbitSettings){
        const data = {
            eccentricity:     elements.eccentricity,
            semiMajorAxis:    elements.semiMajorAxis,
            inclination:      elements.inclination,
            ascNodeLongitude: elements.ascNodeLongitude,
            argOfPeriapsis:   elements.argOfPeriapsis
        };

        return new Orbit(data, attractor, config, false);
    }
    
    /**
     * @param meanAnomaly0 The mean anomaly at some known reference date
     * @param epoch The epoch at which the meanAnomaly0 corresponds
     * @param date The elapsed time (in seconds) from the reference date at which we want the anomaly
     * @returns The true anomaly of the body on its orbit at the specified date.
     */
    public solveTrueAnomalyAtDate(meanAnomaly0: number, epoch: number, date: number){
        const e = this.eccentricity;
        const deltaTime = date - epoch;
        const M = meanAnomaly0 + this.meanMotion * deltaTime;

        const newton = (
            f: (x: number) => number,
            df: (x: number) => number,
        ) => {
            let n = 0;
            let prevX = M;
            let x = M - f(M) / df(M);
            while(Math.abs(x - prevX) > 1e-15 && n < 1000){
                prevX = x;
                x -= f(x) / df(x);
                n++;
            }
            return x;
        };

        // Solving Kepler's equation for eccentric anomaly with Newton's method.
        if(this.eccentricity < 1) {
            const E = newton(
                x => x - e * Math.sin(x) - M,
                x => 1 - e * Math.cos(x),
            );
            return 2 * Math.atan(Math.sqrt((1 + e)/(1 - e)) * Math.tan(E * 0.5));
        } else {
            const H = newton(
                x => e * Math.sinh(x) - x - M,
                x => e * Math.cosh(x) - 1,
            );
            return 2 * Math.atan(Math.sqrt((e + 1)/(e - 1)) * Math.tanh(H * 0.5));
        }
    }

    /**
     * @param trueAnomaly The true anomaly on the orbit
     * @returns The cartesian coordinates of the orbit, centered on the attractor body.
     */
    public positionFromTrueAnomaly(trueAnomaly: number){
        const pos = this.periapsisDir.clone();
        pos.applyAxisAngle(this.normal, trueAnomaly);
        pos.multiplyScalar(this.radius(trueAnomaly));
        return pos;
    }

    public velocityFromTrueAnomaly(trueAnomaly: number){
        const e = this.eccentricity;
        const mu = this.attractor.stdGravParam;
        const nu = trueAnomaly;
        const a = this.semiMajorAxis;

        const r = this.radius(nu);
        const vel = new THREE.Vector3();

        if(e < 1) { // Elliptical orbit
            const v = Math.sqrt(mu * a) / r;
            const E = 2 * Math.atan( Math.tan(nu*0.5) * Math.sqrt((1-e)/(1+e)) );
            vel.set(-v * Math.sin(E), 0, -v * Math.sqrt(1 - e*e) * Math.cos(E));
        } else { // Hyperbolic orbit (the case e = 1, parabolic orbit, will never be reached)
            const v = Math.sqrt(-mu * a) / r;
            const H = 2 * Math.atanh( Math.tan(nu*0.5) * Math.sqrt((e-1)/(e+1)) );
            vel.set(-v * Math.sinh(H), 0, -v * Math.sqrt(e*e - 1) * Math.cosh(H));
        }

        const right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0);
        const ascNodeDir = right.clone();
        ascNodeDir.applyAxisAngle(up, this.ascNodeLongitude);

        vel.applyAxisAngle(up, this.ascNodeLongitude);
        vel.applyAxisAngle(up, this.argOfPeriapsis);
        vel.applyAxisAngle(ascNodeDir, this.inclination);

        return vel;
    }

    /**
     * @param trueAnomaly The true anomaly
     * @returns The real radius of the orbit for the specified anomaly.
     */
    public radius(trueAnomaly: number) {
        return this.orbitalParam / (1 + this.eccentricity * Math.cos(trueAnomaly));
    }

    /**
     * Computes the position and velocity on the orbit at a specific date.
     * @param meanAnomaly0 The reference mean anomaly.
     * @param epoch The date at which the reference mean anomaly corresponds to.
     * @param date The date at which compute the position.
     * @returns The position and velocity on the orbit at the specified date.
     */
    public stateAtDate(meanAnomaly0: number, epoch: number, date: number){
        const nu = this.solveTrueAnomalyAtDate(meanAnomaly0, epoch, date);
        const pos = this.positionFromTrueAnomaly(nu);
        const vel = this.velocityFromTrueAnomaly(nu);
        return {pos, vel};
    }
}