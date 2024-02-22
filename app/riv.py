import subprocess
import os
from pathlib import Path
import tempfile

from .settings import AppSettings, STORAGE_PATH

def riv_get_cartridges_path():
    if AppSettings.rivemu_path is None: # use riv os
        return f"/rivos/{AppSettings.cartridges_path}"
    return f"{STORAGE_PATH or '.'}/{AppSettings.cartridges_path}"


def riv_get_cartridge_info(cartridge_id):
    args = ["sqfscat","-st"]
    if AppSettings.rivemu_path is None: # use riv os
        args.append(f"/rivos/{AppSettings.cartridges_path}/{cartridge_id}")
    else:
        args.append(f"{AppSettings.cartridges_path}/{cartridge_id}")
    args.append("/info.json")
        
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode > 0:
        raise Exception(f"Error getting info: {str(result.stderr)}")

    return result.stdout

def riv_get_cover(cartridge_id):
    args = ["sqfscat","-no-exit"]
    if AppSettings.rivemu_path is None: # use riv os
        args.append(f"/rivos/{AppSettings.cartridges_path}/{cartridge_id}")
    else:
        args.append(f"{AppSettings.cartridges_path}/{cartridge_id}")
    args.append("/cover.png")
        
    result = subprocess.run(args, capture_output=True)
    if result.returncode > 0:
        raise Exception(f"Error getting cover: {str(result.stderr)}")

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
        result = subprocess.run(args)
        
        if result.returncode != 0:
            raise Exception("Error getting screenshot: {str(result.stderr)}")

        cartridge_screenshot = open(screenshot_path,'rb').read()
        os.remove(screenshot_path)

        return cartridge_screenshot
            
    # use rivemu
    screenshot_temp = tempfile.NamedTemporaryFile()

    cwd=str(Path(AppSettings.rivemu_path).parent.parent.absolute())
    absolute_cartridge_path = os.path.abspath(f"{AppSettings.cartridges_path}/{cartridge_id}")
    args.append(AppSettings.rivemu_path)
    args.append(f"-cartridge={absolute_cartridge_path}")
    args.append(f"-save-screenshot={screenshot_temp.name}")
    args.append(f"-stop-frame={frame}")
    # args.append(f"-no-yield=y")
    result = subprocess.run(args, cwd=cwd)

    if result.returncode != 0:
        raise Exception(f"Error getting screenshot: {str(result.stderr)}")

    cartridge_screenshot = open(screenshot_temp.name,'rb').read()
    screenshot_temp.close()

    return cartridge_screenshot

def replay_log(cartridge_id,log,riv_args,in_card):
    if AppSettings.rivemu_path is None: # use riv os
        replay_path = "/run/replaylog"
        outcard_path = "/run/outcard"
        incard_path = "/run/incard"
        outhash_path = "/run/outhash"
        screenshot_path = "/run/screenshot"
        
        replay_file = open(replay_path,'wb')
        replay_file.write(log)
        replay_file.close()

        if os.path.exists(outcard_path): os.remove(outcard_path)
        if os.path.exists(outhash_path): os.remove(outhash_path)
        if os.path.exists(screenshot_path): os.remove(screenshot_path)

        if in_card is not None and len(in_card) > 0:
            incard_file = open(incard_path,'wb')
            incard_file.write(in_card)
            incard_file.close()

        run_args = []
        run_args.append("riv-chroot")
        run_args.append("/rivos")
        run_args.extend(["--setenv", "RIV_CARTRIDGE", f"/{AppSettings.cartridges_path}/{cartridge_id}"])
        run_args.extend(["--setenv", "RIV_REPLAYLOG", replay_path])
        run_args.extend(["--setenv", "RIV_OUTCARD", outcard_path])
        run_args.extend(["--setenv", "RIV_OUTHASH", outhash_path])
        run_args.extend(["--setenv", "RIV_SAVE_SCREENSHOT", screenshot_path])
        if in_card is not None and len(in_card) > 0:
            run_args.extend(["--setenv", "RIV_INCARD", incard_path])
        run_args.extend(["--setenv", "RIV_NO_YIELD", "y"])
        run_args.append("riv-run")
        if riv_args is not None and len(riv_args) > 0:
            run_args.extend(riv_args.split())
        result = subprocess.run(run_args)
        if result.returncode != 0:
            raise Exception(f"Error processing replay: {str(result.stderr)}")

        outcard_raw = open(outcard_path, 'rb').read()
        os.remove(outcard_path)

        outhash = bytes.fromhex(open(outhash_path, 'r').read())
        os.remove(outhash_path)

        screenshot = open(screenshot_path,'rb').read()
        os.remove(screenshot_path)

        return outcard_raw, outhash, screenshot

    # use rivemu
    replay_temp = tempfile.NamedTemporaryFile()
    replay_file = replay_temp.file
    incard_temp = tempfile.NamedTemporaryFile()
    incard_file = incard_temp.file
    outcard_temp = tempfile.NamedTemporaryFile()
    outhash_temp = tempfile.NamedTemporaryFile(mode='w+')
    screenshot_temp = tempfile.NamedTemporaryFile()

    replay_file.write(log)
    replay_file.flush()
    
    if in_card is not None and len(in_card) > 0:
        incard_file.write(in_card)
        incard_file.flush()

    incard_path = len(in_card) > 0 and incard_temp.name or None

    absolute_cartridge_path = os.path.abspath(f"{AppSettings.cartridges_path}/{cartridge_id}")
    cwd = str(Path(AppSettings.rivemu_path).parent.parent.absolute())
    run_args = []
    run_args.append(AppSettings.rivemu_path)
    run_args.append(f"-cartridge={absolute_cartridge_path}")
    run_args.append(f"-verify={replay_temp.name}")
    run_args.append(f"-save-outcard={outcard_temp.name}")
    run_args.append(f"-save-outhash={outhash_temp.name}")
    run_args.append(f"-speed=1000000")
    run_args.append(f"-save-screenshot={screenshot_temp.name}")
    if in_card is not None and len(in_card):
        run_args.append(f"-load-incard={incard_temp.name}")
    if riv_args is not None and len(riv_args) > 0:
        run_args.extend(riv_args.split())

    result = subprocess.run(run_args, cwd=cwd)
    if result.returncode != 0:
        raise Exception(f"Error processing replay: {str(result.stderr)}")

    outcard_raw = outcard_temp.file.read()
    outhash = bytes.fromhex(outhash_temp.file.read())
    screenshot = screenshot_temp.file.read()

    replay_temp.close()
    outcard_temp.close()
    incard_temp.close()
    outhash_temp.close()
    screenshot_temp.close()

    return outcard_raw, outhash, screenshot

def riv_get_cartridge_outcard(cartridge_id,frame,riv_args,in_card):
    if AppSettings.rivemu_path is None: # use riv os
        
        outcard_path = "/run/outcard"
        incard_path = "/run/incard"
        
        if os.path.exists(outcard_path): os.remove(outcard_path)

        if in_card is not None and len(in_card) > 0:
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
        if in_card is not None and len(in_card) > 0:
            run_args.extend(["--setenv", "RIV_INCARD", incard_path])
        run_args.append("riv-run")
        if riv_args is not None and len(riv_args) > 0:
            run_args.extend(riv_args.split())
        result = subprocess.run(run_args)
        
        if result.returncode != 0:
            raise Exception(f"Error running cartridge: {str(result.stderr)}")

        outcard_file = open(outcard_path, 'rb')
        outcard_raw = outcard_file.read()

        return outcard_raw
            
    # use rivemu
    incard_temp = tempfile.NamedTemporaryFile()
    incard_file = incard_temp.file
    outcard_temp = tempfile.NamedTemporaryFile()
    outcard_file = outcard_temp.file

    if in_card is not None and len(in_card) > 0:
        incard_file.write(in_card)
        incard_file.flush()

    incard_path = in_card is not None and len(in_card) > 0 and incard_temp.name or None

    absolute_cartridge_path = os.path.abspath(f"{AppSettings.cartridges_path}/{cartridge_id}")
    cwd = str(Path(AppSettings.rivemu_path).parent.parent.absolute())
    run_args = []
    run_args.append(AppSettings.rivemu_path)
    run_args.append(f"-cartridge={absolute_cartridge_path}")
    run_args.append(f"-save-outcard={outcard_temp.name}")
    if in_card is not None and len(in_card):
        run_args.append(f"-load-incard={incard_temp.name}")
    run_args.append(f"-stop-frame={frame}")
    if riv_args is not None and len(riv_args) > 0:
        run_args.extend(riv_args.split())

    result = subprocess.run(run_args, cwd=cwd)
    if result.returncode != 0:
        raise Exception(f"Error running cartridge: {str(result.stderr)}")

    outcard_raw = outcard_file.read()

    outcard_temp.close()
    incard_temp.close()

    return outcard_raw
