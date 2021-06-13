<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { Keypoint } from "@tensorflow-models/posenet";
    import type { Size } from "./PoseMessages";

    export let keypoints: Keypoint[];
    export let size: Size;
    export let reverse = true;

    let reverseTransform = "";
    $: if (reverse) {
        reverseTransform = `scale(-1 1) translate(${-size.width} 0)`;
    }

    const dispatch = createEventDispatcher<{
        "mouseover:keypoint": Keypoint;
        "mouseout:keypoint": Keypoint;
    }>();

    const connections: string[][] = [
        ["leftEar", "leftEye", "nose"],
        ["nose", "rightEye", "rightEar"],
        ["leftHip", "leftShoulder", "rightShoulder", "rightHip"],
        ["leftWrist", "leftElbow", "leftShoulder", "rightShoulder"],
        ["leftShoulder", "rightShoulder", "rightElbow", "rightWrist"],
        [
            "leftAnkle",
            "leftKnee",
            "leftHip",
            "rightHip",
            "rightKnee",
            "rightAnkle",
        ],
    ];

    const connectionPairs: string[][] = connections.flatMap((connection) => {
        const pairs: string[][] = [];
        for (let i = 0; i < connection.length - 1; i++)
            pairs.push([connection[i], connection[i + 1]]);
        return pairs;
    });

    $: keypointPairs = connectionPairs.map((connection) => {
        return connection.flatMap((part) =>
            keypoints.filter((k) => k.part === part)
        );
    });

    export let showNames = false;
    export let showScore = false;
    export let showControls = false;

    const padding = size.width * 0.1;
    const scale = 1 - padding / size.width;
</script>

{#if showControls}
    <label for="showNames">Show names</label>
    <input type="checkbox" id="showNames" bind:checked={showNames} />
    <br />

    <label for="showScore">Show score</label>
    <input type="checkbox" id="showScore" bind:checked={showScore} />
    <br />
{/if}

<svg
    class={$$props.class}
    xmlns="http://www.w3.org/2000/svg"
    viewBox={`-${padding} -${padding} ${size.width + padding} ${
        size.height + padding
    }`}
    fill="none"
>
    <g transform="scale({scale}) {reverseTransform}">
        <rect
            x="0"
            y="0"
            width={size.width}
            height={size.height}
            stroke="#eee"
        />
        {#each keypointPairs as pair (pair)}
            <line
                x1={pair[0].position.x}
                y1={pair[0].position.y}
                x2={pair[1].position.x}
                y2={pair[1].position.y}
                stroke-width={(pair[0].score + pair[1].score) * 2}
                stroke="rgba(0, 0, 0, {(pair[0].score + pair[1].score) *
                    0.33 +
                    0.33})"
            />
        {/each}
        {#each keypoints as k (k.part)}
            <circle
                class="cursor-pointer"
                cx={k.position.x}
                cy={k.position.y}
                r={1 + k.score * 7}
                stroke="rgba(0, 0, 0, {k.score * 0.66 + 0.33})"
                fill="white"
                on:mouseover={() => dispatch("mouseover:keypoint", k)}
                on:mouseout={() => dispatch("mouseout:keypoint", k)}
            />
        {/each}
        {#if showNames}
            {#each keypoints as { position, part } (part)}
                <text x={position.x} y={position.y} class="small" fill="black"
                    >{part}</text
                >
            {/each}
        {/if}
        {#if showScore}
            {#each keypoints as { position, part, score } (part)}
                <text x={position.x} y={position.y} class="small" fill="black"
                    >{score.toFixed(3)}</text
                >
            {/each}
        {/if}
    </g>
</svg>

<style>
    svg {
        overflow: hidden;
        /* background-color: rgba(0,0,0,0.1); */
    }
    svg:hover {
        overflow: visible;
    }

    .cursor-pointer {
        cursor: pointer;
    }
</style>
