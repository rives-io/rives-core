import React from 'react'
import XIcon from '@mui/icons-material/X';
import DiscordLogo from './svg/DiscordLogo';
import Link from 'next/link';

function Footer() {
  return (
    <footer className='footer'>
        <div className='flex space-x-8'>
            <Link href="https://twitter.com/rives_io" rel="noopener noreferrer" target="_blank" className='flex items-center space-x-2'>
                <XIcon/> <span className='hover:underline'>rives_io</span>
            </Link>
            <Link href="https://discord.gg/FQnQqKWVn8" rel="noopener noreferrer" target="_blank" className='flex items-center space-x-2'>
                <DiscordLogo/> <span className='hover:underline'>RiVES</span>
            </Link>
        </div>
    </footer>
  )
}

export default Footer