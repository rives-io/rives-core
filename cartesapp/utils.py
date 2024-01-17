

###
# Conversion Functions

def hex2bytes(hexstr):
    if hexstr.startswith('0x'): 
        hexstr = hexstr[2:]
    return bytes.fromhex(hexstr)

def bytes2str(binstr):
    return binstr.decode("utf-8")

def hex2str(hexstr):
    return bytes2str(hex2bytes(hexstr))

def bytes2hex(value):
    return "0x" + value.hex()

def str2bytes(strtxt):
    return strtxt.encode("utf-8")

def str2hex(strtxt):
    return bytes2hex(str2bytes(strtxt))


###
# Helpers
