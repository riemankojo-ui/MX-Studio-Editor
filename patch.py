import os, shutil

dst = 'android/app/src/main/java/com/rieman/mxstudio'
os.makedirs(dst, exist_ok=True)
for f in os.listdir('native'):
    if f.endswith('.java'):
        shutil.copy('native/' + f, dst + '/' + f)

mf = 'android/app/src/main/AndroidManifest.xml'
s = open(mf).read()
if 'READ_MEDIA_IMAGES' not in s:
    perms = '''
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
    <uses-permission android:name="android.permission.READ_MEDIA_VISUAL_USER_SELECTED"/>
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
'''
    s = s.replace('</manifest>', perms + '</manifest>')
    open(mf, 'w').write(s)

st = 'android/app/src/main/res/values/styles.xml'
if os.path.exists(st):
    t = open(st).read().replace('@drawable/splash', '#FF000000')
    open(st, 'w').write(t)
