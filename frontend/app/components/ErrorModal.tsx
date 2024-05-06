"use client"




import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import ReportIcon from '@mui/icons-material/Report';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';


const ERROR_OPTIONS = ["alert", "warning", "error"] as const;
type ERROR = typeof ERROR_OPTIONS;        // type x = readonly ['op1', 'op2', ...]
type ERROR_OPTIONS_TYPE = ERROR[number];


export interface ERROR_FEEDBACK {
    severity:ERROR_OPTIONS_TYPE,
    message:string,
    dismissible:boolean
}



export default function ErrorModal({error, dissmissFunction}:{error:ERROR_FEEDBACK, dissmissFunction?():void}) {
    if (error.dismissible && !dissmissFunction) throw new Error("Dissmissible Error missing dissmissFunction!")

    let color:string;

    if (error.severity == "alert") {
        color = "yellow";
    } else if (error.severity == "warning") {
        color = "orange";
    } else {
        color = "red"
    }

    
    return (
        <>    
            <Transition appear show={true} as={Fragment}>
                <Dialog as="div" className="relative z-10" onClose={error.dismissible? () => {dissmissFunction!()}:() => null}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/25" />
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
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden bg-gray-500 p-4 shadow-xl transition-all flex flex-col items-center text-white">
                                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                                        {
                                            error.severity == "error"?
                                                <ErrorIcon className={`text-${color}-500 text-5xl`}/>
                                            :
                                                error.severity == "warning"?
                                                    <WarningIcon className={`text-${color}-500 text-5xl`} />
                                                :
                                                    <ReportIcon className={`text-${color}-500 text-5xl`} />
                                        }
                                        
                                    </Dialog.Title>
                                    <div className='flex w-96 flex-wrap justify-center'>
                                        <span>{error.message}</span>
                                    </div>

                                    {
                                        error.dismissible?
                                            <button 
                                            className={`mt-4 bg-${color}-500 text-white p-3 border border-${color}-500 hover:text-${color}-500 hover:bg-transparent`}
                                            onClick={dissmissFunction}
                                            >
                                                OK
                                            </button>
                                        :
                                            <></>
                                    }
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </>
    )
}