"use client"


import React from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';

function YoutubeVideo({videoId}:{videoId:string}) {
  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    // access to player in all event handlers via event.target
    event.target.pauseVideo();
  }

  const opts: YouTubeProps['opts'] = {
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      autoplay: 1,
    },
  };

  return <YouTube videoId={videoId} opts={opts} onReady={onPlayerReady} />;
}

export default YoutubeVideo;