"use client"




import React, { Fragment, useContext, useEffect, useState } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { Dialog, Tab, Transition } from '@headlessui/react'
import DescriptionIcon from '@mui/icons-material/Description';

import CartridgeDescription from './CartridgeDescription';
import Link from 'next/link';
import PlayModes from './PlayModes';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';


function CartridgeInfo() {
    const {selectedCartridge, changeCartridge} = useContext(selectedCartridgeContext);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (selectedCartridge && !isOpen) setIsOpen(true);
    }, [selectedCartridge])

    function closeModal() {
        changeCartridge(null);
        setIsOpen(false);
    }


    if (!selectedCartridge) return <></>;

    return (
            <Transition appear show={isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-10" onClose={closeModal}>
                    <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/90" />
                    </Transition.Child>
        
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-screen-lg transform overflow-hidden p-6 text-left align-middle shadow-xl transition-all">
                                    <div className="flex flex-wrap justify-center h-full w-full">

                                        <div className="md:w-[512px] lg:w-[768px]">
                                            <div className="text-white mb-2">
                                                <span className='text-4xl'>{selectedCartridge.name}</span>

                                                {
                                                !(selectedCartridge.info?.authors)?
                                                    <div className='h-6'></div>
                                                :
                                                (
                                                    <div className='flex space-x-2'>
                                                        <span>By</span>
                                                        <ul>
                                                            {selectedCartridge.info?.authors?.map((author, index) => (
                                                                <li key={author.name}>
                                                                    <Link href={author.link}>
                                                                        {author.name}{index !== selectedCartridge.info!.authors!.length-1? ",": ""}
                                                                    </Link>
                                                                </li>
                                                            ))}
                                                        </ul>

                                                    </div>
                                                )
                                                }
                                            </div>

                                            <Tab.Group>
                                                <Tab.List className="game-option-tabs-header">
                                                    <Tab
                                                        className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                                                        >
                                                            <span className='game-tabs-option-text'>
                                                                <DescriptionIcon/>
                                                                <span>Description</span>
                                                            </span>
                                                    </Tab>

                                                    <Tab
                                                        className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                                                        >
                                                            <span className='game-tabs-option-text'>
                                                                <PlayArrowIcon/>
                                                                <span>Play Modes</span>
                                                            </span>
                                                    </Tab>
                                                </Tab.List>

                                                <Tab.Panels className="mt-2 overflow-auto custom-scrollbar">
                                                    <Tab.Panel className="game-tab-content ">
                                                        <CartridgeDescription/>
                                                    </Tab.Panel>

                                                    <Tab.Panel className="game-tab-content">
                                                        <PlayModes/>

                                                    </Tab.Panel>

                                                </Tab.Panels>
                                            </Tab.Group>

                                            <Link href={`play/cartridge/${selectedCartridge.id}`} rel="noopener noreferrer" target="_blank"
                                            className="btn w-full mt-2 flex justify-center">
                                                PLAY (default mode)
                                            </Link>
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
    );
}

export default CartridgeInfo