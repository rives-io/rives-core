import { useRef, useEffect } from 'react'

export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}


export function usePrevious(value: any) {
    const ref = useRef();
    useEffect(() => {
        ref.current = value;
    },[value]);
    return ref.current;
}