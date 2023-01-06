import { KSPTime } from "../time/time.js";
import { joinStrings } from "./array.js";
export function trajectoryToText(traj, seq) {
    const { steps, system, config } = traj;
    const pairs = [];
    const add = (label, data, indent) => {
        pairs.push({ label, data, indent });
    };
    const space = () => add("", "", 0);
    add("Sequence", seq.seqStringFullNames, 0);
    const depDate = KSPTime(steps[0].dateOfStart, config.time);
    const arrDate = KSPTime(steps[steps.length - 1].dateOfStart, config.time);
    add("Departure", depDate.stringYDHMS("hms", "ut"), 0);
    add("Arrival", arrDate.stringYDHMS("hms", "ut"), 0);
    add("Total ΔV", `${traj.totalDeltaV.toFixed(1)} m/s`, 0);
    space();
    add("Steps", "", 0);
    let maneuvreIdx = 0, flybyIdx = 0;
    for (let i = 0; i < steps.length; i++) {
        const { maneuvre, flyby } = steps[i];
        if (maneuvre) {
            space();
            const step = steps[i];
            const details = traj.maneuvres[maneuvreIdx];
            const context = step.maneuvre.context;
            const { progradeDV, normalDV, radialDV, totalDV } = details;
            let label;
            if (context.type == "ejection") {
                const startBodyName = system.bodyFromId(step.attractorId).name;
                label = `${startBodyName} escape`;
            }
            else if (context.type == "dsm") {
                const originName = system.bodyFromId(context.originId).name;
                const targetName = system.bodyFromId(context.targetId).name;
                label = `${originName}-${targetName} DSM`;
            }
            else {
                const arrivalBodyName = system.bodyFromId(step.attractorId).name;
                label = `${arrivalBodyName} circularization`;
            }
            add(label, "", 1);
            const dateMET = KSPTime(details.dateMET, config.time);
            add("Date", dateMET.toUT(depDate).stringYDHMS("hms", "ut") + " UT", 2);
            add("", dateMET.stringYDHMS("hms", "emt") + " MET", 2);
            if (details.ejectAngle !== undefined) {
                add("Ejection angle", `${details.ejectAngle.toFixed(1)}°`, 2);
            }
            add("ΔV", `${totalDV.toFixed(1)} m/s`, 2);
            add("Prograde", `${progradeDV.toFixed(1)}`, 3);
            add("Normal", `${normalDV.toFixed(1)}`, 3);
            add("Radial", `${radialDV.toFixed(1)}`, 3);
            maneuvreIdx++;
        }
        else if (flyby) {
            space();
            const details = traj.flybys[flybyIdx];
            const bodyName = system.bodyFromId(details.bodyId).name;
            const enterMET = KSPTime(details.soiEnterDateMET, config.time);
            const exitMET = KSPTime(details.soiExitDateMET, config.time);
            add(`Flyby around ${bodyName}`, "", 1);
            add("SOI enter date", enterMET.toUT(depDate).stringYDHMS("hms", "ut") + " UT", 2);
            add("", enterMET.stringYDHMS("hms", "emt") + " MET", 2);
            add("SOI exit date", exitMET.toUT(depDate).stringYDHMS("hms", "ut") + " UT", 2);
            add("", exitMET.stringYDHMS("hms", "emt") + " MET", 2);
            add("Periapsis altitude", `${details.periAltitude.toFixed(0)} km`, 2);
            add("Inclination", `${details.inclinationDeg.toFixed(0)}°`, 2);
            flybyIdx++;
        }
    }
    return pairsToString(pairs);
}
function pairsToString(pairs) {
    const lines = [];
    for (const pair of pairs) {
        if (pair.label == "") {
            lines.push("");
            continue;
        }
        let indent = " ".repeat(pair.indent * 2);
        lines.push(`${indent}${pair.label}:`);
    }
    let maxLen = 0;
    for (const line of lines) {
        maxLen = Math.max(maxLen, line.length);
    }
    for (let i = 0; i < pairs.length; i++) {
        if (pairs[i].label == "" && pairs[i].data == "")
            continue;
        const spaces = " ".repeat(maxLen - lines[i].length + 1);
        lines[i] += spaces + pairs[i].data;
    }
    return joinStrings(lines, "\n");
}
