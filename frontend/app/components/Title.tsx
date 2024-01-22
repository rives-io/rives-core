import React from 'react'
import { fontPressStart2P } from '../utils/font';

import Image from 'next/image'
import rivesLogo from '../../public/logo.png';

function Title() {
  return (
    // <div className="grid grid-cols-1">
    //     <h1 className={`${fontPressStart2P.className} title-text`}>
    //             <span>RiVES</span>
    //     </h1>
    //     <span className="subtitle-text">RiscV Verifiable Entertainment System</span>
    // </div>

    <div className="flex space-x-2">
    {/* <h1 className='title-text'>
            <span>RiVES</span>
    </h1> */}
      <Image width={250} src={rivesLogo} alt='RiVES logo'/>
    </div>
  )
}

export default Title