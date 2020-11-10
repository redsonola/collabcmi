<script lang="ts">
    export let score: number = 0;
    export let label: string = "";
  
    function round(number, digits = 3): string {
      if (typeof number === 'number')
        return number.toFixed(digits);
      else
        return '';
    }
  
  </script>
  
  <style>
    .score-bar-row {
      width: 100px;
    }
  
    .score-bar {
      text-align: left;
      font-size: 9px;
      line-height: 1rem;
      font-weight: 100;
      margin: 0;
      padding: 0;
      font-family: monospace;
      height: 1rem;
      background-color: cyan;
      box-sizing: border-box;
      border: solid rgba(0, 0, 0, 0.5) 1px;
    }
  </style>
  
{label}
<div class="score-bar" style={`width: ${score * 100}%`}>&nbsp;{round(score)}</div>
           