import { OrbitingBody } from "../objects/body.js";
import { SolarSystem } from "../objects/system.js";
import { joinStrings } from "../utilities/array.js";

export class FlybySequence {
    public readonly bodies!:    OrbitingBody[];
    public readonly length!:    number;
    public readonly seqString!: string;
    
    constructor(system: SolarSystem, public readonly ids: number[]) {
        this.bodies = [];
        for(const id of ids){
            this.bodies.push(system.bodyFromId(id) as OrbitingBody);
        }
        this.length = this.bodies.length;

        const initials = this.bodies.map((body: OrbitingBody) => body.name.substring(0, 2));
        this.seqString = joinStrings(initials, "-");
    }

    get seqStringFullNames(){
        const names = this.bodies.map((body: OrbitingBody) => body.name);
        return joinStrings(names, "-");
    }

    static fromString(str: string, system: SolarSystem){
        str = str.trim();
        const initials = str.split('-');
        const ids: number[] = [];

        let attractor = 0;

        for(let i = 0; i < initials.length; i++){
            let valid = false;
            for(const body of system.orbiting){
                if(body.name.substring(0, 2) == initials[i]){
                    if(i == 0) {
                        attractor = body.attractor.id;
                    } else if(body.attractor.id != attractor) {
                        throw new Error("All bodies of the sequence must orbit around the same body.");
                    }
                    ids.push(body.id);
                    valid = true;
                    break;
                }
            }
            if(!valid){
                throw new Error("Invalid custom sequence input.");
            }
        }

        if(ids.length <= 1){
            throw new Error("The sequence must contain at least two bodies.");
        }

        return new FlybySequence(system, ids);
    }
}