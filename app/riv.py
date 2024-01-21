import subprocess
import os
from pathlib import Path
import tempfile

from .setup import AppSettings

def riv_get_cartridges_path():
    if AppSettings.rivemu_path is None: # use riv os
        return f"/rivos/{AppSettings.cartridges_path}"
    return AppSettings.cartridges_path


def riv_get_cartridge_info(cartridge_id):
    args = []
    if AppSettings.rivemu_path is None: # use riv os
        args.append("riv-chroot")
        args.append("/rivos")
        args.extend(["sqfscat","-st",f"/{AppSettings.cartridges_path}/{cartridge_id}"])
    else:
        args.extend(["sqfscat","-st",f"{AppSettings.cartridges_path}/{cartridge_id}"])
    args.append("/info.json")
        
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode > 0:
        raise Exception("Error getting info")

    return result.stdout


def riv_get_cartridge_screenshot(cartridge_id,frame):
    args = []
    if AppSettings.rivemu_path is None: # use riv os
        screenshot_path = "/run/screenshot"
        if os.path.exists(screenshot_path): os.remove(screenshot_path)
        args.append("riv-chroot")
        args.append("/rivos")
        args.extend(["--setenv", "RIV_CARTRIDGE", f"/{AppSettings.cartridges_path}/{cartridge_id}"])
        args.extend(["--setenv", "RIV_SAVE_SCREENSHOT", screenshot_path])
        args.extend(["--setenv", "RIV_STOP_FRAME", f"{frame}"])
        args.extend(["--setenv", "RIV_NO_YIELD", "y"])
        args.append("riv-run")
        result = subprocess.run(args, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception("Error getting cover")

        cartridge_cover = open(screenshot_path,'rb').read()
        os.remove(screenshot_path)

        return cartridge_cover
            
    # use rivemu
    screenshot_temp = tempfile.NamedTemporaryFile()
    screenshot_file = screenshot_temp.file

    cwd=str(Path(AppSettings.rivemu_path).parent.parent.absolute())
    absolute_cartridge_path = os.path.abspath(f"{AppSettings.cartridges_path}/{cartridge_id}")
    args.append(AppSettings.rivemu_path)
    args.append(f"-cartridge={absolute_cartridge_path}")
    args.append(f"-save-screenshot={screenshot_file.name}")
    args.append(f"-stop-frame={frame}")
    # args.append(f"-no-yield=y")
    result = subprocess.run(args, capture_output=True, text=True, cwd=cwd)

    if result.returncode != 0:
        raise Exception(f"Error getting cover")

    cartridge_cover = open(screenshot_file.name,'rb').read()
    screenshot_temp.close()

    return cartridge_cover

def replay_log(cartridge_id,log,riv_args,in_card):
    if AppSettings.rivemu_path is None: # use riv os
        replay_path = "/run/replaylog"
        outcard_path = "/run/outcard"
        incard_path = "/run/incard"
        
        replay_file = open(replay_path,'wb')
        replay_file.write(log)
        replay_file.close()

        if os.path.exists(outcard_path): os.remove(outcard_path)

        if len(in_card) > 0:
            incard_file = open(incard_path,'wb')
            incard_file.write(in_card)
            incard_file.close()

        run_args = []
        run_args.append("riv-chroot")
        run_args.append("/rivos")
        run_args.extend(["--setenv", "RIV_CARTRIDGE", f"/{AppSettings.cartridges_path}/{cartridge_id}"])
        run_args.extend(["--setenv", "RIV_REPLAYLOG", replay_path])
        run_args.extend(["--setenv", "RIV_OUTCARD", outcard_path])
        if len(in_card) > 0:
            run_args.extend(["--setenv", "RIV_INCARD", incard_path])
        run_args.extend(["--setenv", "RIV_NO_YIELD", "y"])
        run_args.append("riv-run")
        if riv_args is not None:
            run_args.append(riv_args)
        result = subprocess.run(run_args, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"Error processing replay: {result.stderr}")

        outcard_file = open(outcard_path, 'rb')
        outcard_raw = outcard_file.read()

        return outcard_raw.strip()

    # use rivemu
    replay_temp = tempfile.NamedTemporaryFile()
    replay_file = replay_temp.file
    incard_temp = tempfile.NamedTemporaryFile()
    incard_file = incard_temp.file
    outcard_temp = tempfile.NamedTemporaryFile()
    outcard_file = outcard_temp.file

    replay_file.write(log)
    replay_file.flush()
    
    if len(in_card) > 0:
        incard_file.write(in_card)
        incard_file.flush()

    incard_path = len(in_card) > 0 and incard_temp.name or None

    absolute_cartridge_path = os.path.abspath(f"{AppSettings.cartridges_path}/{cartridge_id}")
    cwd = str(Path(AppSettings.rivemu_path).parent.parent.absolute())
    run_args = []
    run_args.append(AppSettings.rivemu_path)
    run_args.append(f"-cartridge={absolute_cartridge_path}")
    run_args.append(f"-verify={replay_temp.name}")
    # run_args.append(f"-save-outcard={outcard_temp.name}")
    if len(in_card):
        run_args.append(f"-load-incard={incard_temp.name}")
    run_args.append(f"-no-yield=y")
    if riv_args is not None:
        run_args.append(riv_args)
    p1 = subprocess.Popen(run_args,stdout=subprocess.PIPE, cwd=cwd)
    p2 = subprocess.Popen(["sed","-n","/==== BEGIN OUTCARD ====/,/==== END OUTCARD ====/p"],stdin=p1.stdout,stdout=subprocess.PIPE)
    p3 = subprocess.Popen(["head","-n","-1"],stdin=p2.stdout,stdout=subprocess.PIPE)

    fout = open(outcard_temp.name, 'wb')

    result = subprocess.run(["tail","-n","+2"], stdin=p3.stdout,stdout=fout,stderr=subprocess.PIPE)

    if result.returncode != 0:
        raise Exception(f"Error processing replay: {result.stderr}")

    outcard_raw = outcard_file.read()

    replay_temp.close()
    outcard_temp.close()
    incard_temp.close()

    return outcard_raw.strip()

def riv_get_cartridge_outcard(cartridge_id,frame,riv_args,in_card):
    if AppSettings.rivemu_path is None: # use riv os
        
        outcard_path = "/run/outcard"
        incard_path = "/run/incard"
        
        if os.path.exists(outcard_path): os.remove(outcard_path)

        if len(in_card) > 0:
            incard_file = open(incard_path,'wb')
            incard_file.write(in_card)
            incard_file.close()

        run_args = []
        run_args.append("riv-chroot")
        run_args.append("/rivos")
        run_args.extend(["--setenv", "RIV_CARTRIDGE", f"/{AppSettings.cartridges_path}/{cartridge_id}"])
        run_args.extend(["--setenv", "RIV_NO_YIELD", "y"])
        run_args.extend(["--setenv", "RIV_STOP_FRAME", f"{frame}"])
        run_args.extend(["--setenv", "RIV_OUTCARD", outcard_path])
        if len(in_card) > 0:
            run_args.extend(["--setenv", "RIV_INCARD", incard_path])
        run_args.append("riv-run")
        if riv_args is not None:
            run_args.append(riv_args)
        result = subprocess.run(run_args, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception("Error running cartridge")

        outcard_file = open(outcard_path, 'rb')
        outcard_raw = outcard_file.read()

        return outcard_raw.strip()
            
    # use rivemu
    incard_temp = tempfile.NamedTemporaryFile()
    incard_file = incard_temp.file
    outcard_temp = tempfile.NamedTemporaryFile()
    outcard_file = outcard_temp.file

    if len(in_card) > 0:
        incard_file.write(in_card)
        incard_file.flush()

    incard_path = len(in_card) > 0 and incard_temp.name or None

    absolute_cartridge_path = os.path.abspath(f"{AppSettings.cartridges_path}/{cartridge_id}")
    cwd = str(Path(AppSettings.rivemu_path).parent.parent.absolute())
    run_args = []
    run_args.append(AppSettings.rivemu_path)
    run_args.append(f"-cartridge={absolute_cartridge_path}")
    # run_args.append(f"-save-outcard={outcard_temp.name}")
    if len(in_card):
        run_args.append(f"-load-incard={incard_temp.name}")
    # run_args.append(f"-no-yield=y")
    run_args.append(f"-stop-frame={frame}")
    if riv_args is not None:
        run_args.append(riv_args)
    p1 = subprocess.Popen(run_args,stdout=subprocess.PIPE, cwd=cwd)
    p2 = subprocess.Popen(["grep","-A1","==== BEGIN OUTCARD ===="],stdin=p1.stdout,stdout=subprocess.PIPE)

    fout = open(outcard_temp.name, 'wb')

    result = subprocess.run(["tail","-1"], stdin=p2.stdout,stdout=fout,stderr=subprocess.PIPE)

    if result.returncode != 0:
        raise Exception(f"Error running cartridge: {result.stderr}")

    outcard_raw = outcard_file.read()

    outcard_temp.close()
    incard_temp.close()

    return outcard_raw.strip()
