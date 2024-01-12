import Link from 'next/link'
import React from 'react'

function Title() {
  return (
    <div className="grid grid-cols-1">
        <h1 className='title-text'>
                <span>World</span>
                <br/>
                <span className='ps-16'>Arcade</span>
        </h1>
        <span className="subtitle-text justify-self-end">Powered by <Link className="link-2step-hover" href="https://cartesi.io/">Cartesi</Link></span>
    </div>
  )
}

export default Title