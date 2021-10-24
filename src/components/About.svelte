<svelte:head>
  <title>About Skin Hunger</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/about.css">
</svelte:head>

<style>
body {font-family: "verdana", Geneva, sans-serif; }
h1, h2, h3, h4, h5, h6 {
  
  letter-spacing: 5px;
}
</style>

<!-- Navbar (sit on top) 
<div class="w3-top">
  <div class="w3-bar w3-white w3-padding w3-card" style="letter-spacing:4px;">
    <a href="#home" class="w3-bar-item w3-button">Gourmet au Catering</a>
     Right-sided navbar links. Hide them on small screens 
    <div class="w3-right w3-hide-small">
      <a href="#about" class="w3-bar-item w3-button">About</a>
      <a href="#menu" class="w3-bar-item w3-button">Menu</a>
      <a href="#contact" class="w3-bar-item w3-button">Contact</a>
    </div>
  </div>
</div>
-->

<!-- Header -->
<header class="w3-display-container w3-content w3-wide" style="max-width:1600px;min-width:500px" id="home">
  <img class="w3-image" src="/img/skinhunger.jpg" alt="Skin Hunger" width="1600" height="500">
  <div class="w3-display-bottomleft w3-padding-large w3-opacity">
  <p>

  </div>
</header>

<!-- Page content -->
<div class="w3-content" style="max-width:1100px">

  <!-- About Section -->
  <div class="w3-row w3-padding-64" id="about">
    <div class="w3-col m6 w3-padding-large w3-hide-small">
     <img src="/img/aboutimg.jpg" class="w3-round w3-image w3-opacity-min" alt="about Skin Hunger" width="600" height="750"><br>
     <img src="/img/aboutimg2.jpg" class="w3-round w3-image w3-opacity-min" alt="about Skin Hunger 2" width="600" height="750"><br>
        <img src="/img/aboutimg3.jpg" class="w3-round w3-image w3-opacity-min" alt="about Skin Hunger 3" width="600" height="750">
    </div>

    <div class="w3-col m6 w3-padding-large">
      <h1 class="w3-center">About 'Skin Hunger'</h1><br>
      <h5 class="w3-center">Courtney Brown, Melanie Clemmons, Ira Greenberg, Brent Brimhall
</h5>
      <p class="w3-large">Skin Hunger is a telematic installation that plays on the zoom-style video-chat that has become ubiquitous during the COVID-19 pandemic. Participants can reach across their screens to virtually ‘touch’ one another.  By touching or moving together, participants create virtual organisms and sounds that emerge and evolve from participant relation and interaction, making the intangible connection tangible and giving it life.  </p>

        <p class="w3-large">Initially included in CICA Museum’s #social21 exhibition (October 13-31st 2021) we wanted to share the experience further by adding five satellite locations concurrent with #social21. Participants in these satellite locations connect and interact with each other in rotation. </p>
        
        <p class="w3-large">The satellite installations are at: University of Texas at Dallas’ LabSynthE (Dallas, Texas), Southern Methodist University’s Hamon Arts Library (Dallas, Texas), University of North Texas’ CVAD New Media Alcove (Denton, Texas), Florida Western University (Fort Myers, Florida), and Arizona State University (Phoenix, Arizona). </p>
      <p class="w3-large">This work was created in response to the increased use of video communication during the 2020 pandemic, and the stress incurred due to a lack of touch as a result of social distancing. Lack of touch can result in touch starvation, sometimes referred to as skin hunger, which leads to increased levels of cortisol and feelings of social exclusion. While the remedy for touch starvation is skin to skin contact, we offer a digital alternative for those unable to obtain that remedy. Additionally, we hope that participants will enjoy a break from the confines of the rectangular grid of video communication.</p>
    </div>
  </div>
  
  <hr>
  
  <!-- Bios -->
  <div class="w3-row w3-padding-64" id="menu">
    <div class="w3-col l6 w3-padding-large">
     <!-- <h1 class="w3-center">Creators</h1><br> -->
      <h4><a href="http://www.courtney-brown.net/" target="_blank" class="w3-hover-text-deep-purple">Courtney Brown</a></h4>
      <p class="w3-text-grey">Courtney Brown is a composer/performer, software developer, and tango dancer. Her work includes  new musical interfaces, sound installations, and interactive musical performance + improvisation.</p><br>
    
      <h4><a href="http://www.instagram.com/auraquartz" target="_blank" class="w3-hover-text-deep-purple">Melanie Clemmons</a></h4>
      <p class="w3-text-grey">Melanie Clemmons (she/her) is a new media artist interested in reimagining our use of digital technology toward a softer, calmer, and more careful future. She makes videos, net art, installations and XR experiences.</p><br>
    
      <h4><a href="http://iragreenberg.org/" target="_blank" class="w3-hover-text-deep-purple">Ira Greenberg</a></h4>
      <p class="w3-text-grey">With an eclectic background combining studio arts and computer science, Ira Greenberg has been a painter, 2D and 3D animator, print designer, web and interactive designer/developer, programmer, art director, creative director, managing director, art and computer science professor and author.</p><br>
    
      <h4><a href="https://www.linkedin.com/in/brent-brimhall-55836010" target="_blank" class="w3-hover-text-deep-purple">Brent Brimhall</a></h4>
      <p class="w3-text-grey">Brent Brimhall is a dancer and software developer with over ten years of web development experience. He currently works at Motorola, Inc.</p><br>
        
    </div>
    
    <!-- <div class="w3-col l6 w3-padding-large">
      <img src="headshots.jpg" class="w3-round w3-image w3-opacity-min" alt="headshots" style="width:100%">    </div>  -->

  </div>
</div>

<!-- Footer -->
<!-- <footer class="w3-center w3-grey w3-padding-32">
  <p><a href="/" title="home" class="w3-hover-text-deep-purple">Back to Skin Hunger</a></p>
</footer> -->
