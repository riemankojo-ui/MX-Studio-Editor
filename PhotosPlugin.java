package com.rieman.mxstudio;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "Photos", permissions = {
        @Permission(strings = {"android.permission.READ_MEDIA_IMAGES"}, alias = "img13"),
        @Permission(strings = {"android.permission.READ_MEDIA_VISUAL_USER_SELECTED"}, alias = "imgSel"),
        @Permission(strings = {"android.permission.READ_EXTERNAL_STORAGE"}, alias = "imgOld")
})
public class PhotosPlugin extends Plugin {

    private static final Uri IMAGES = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;

    private String oldAlias() {
        return Build.VERSION.SDK_INT >= 33 ? "img13" : "imgOld";
    }

    private boolean granted() {
        if (Build.VERSION.SDK_INT >= 34) {
            return getPermissionState("img13") == PermissionState.GRANTED
                    || getPermissionState("imgSel") == PermissionState.GRANTED;
        }
        return getPermissionState(oldAlias()) == PermissionState.GRANTED;
    }

    // ---------- list photos (asks for permission the first time) ----------
    @PluginMethod
    public void getPhotos(PluginCall call) {
        if (granted()) {
            list(call);
            return;
        }
        if (Build.VERSION.SDK_INT >= 34) {
            requestPermissionForAliases(new String[]{"img13", "imgSel"}, call, "permDone");
        } else {
            requestPermissionForAlias(oldAlias(), call, "permDone");
        }
    }

    @PermissionCallback
    private void permDone(PluginCall call) {
        if (granted()) list(call);
        else call.reject("denied");
    }

    private void list(PluginCall call) {
        int limit = call.getInt("limit", 300);
        int offset = call.getInt("offset", 0);
        JSArray arr = new JSArray();
        String[] cols = {
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT
        };
        try (Cursor c = getContext().getContentResolver().query(
                IMAGES, cols, null, null, MediaStore.Images.Media.DATE_ADDED + " DESC")) {
            if (c != null && c.moveToPosition(offset)) {
                int n = 0;
                do {
                    JSObject o = new JSObject();
                    o.put("id", c.getLong(0));
                    o.put("w", c.getInt(1));
                    o.put("h", c.getInt(2));
                    arr.put(o);
                    n++;
                } while (n < limit && c.moveToNext());
            }
        } catch (Exception e) {
            call.reject("failed");
            return;
        }
        JSObject r = new JSObject();
        r.put("photos", arr);
        call.resolve(r);
    }

    // ---------- save edited photo into the phone gallery ----------
    @PluginMethod
    public void saveImage(PluginCall call) {
        String data = call.getString("data");
        String name = call.getString("name", "MX-Studio");
        long oldId = call.getData().optLong("id", -1);
        if (data == null) { call.reject("no data"); return; }
        if (Build.VERSION.SDK_INT < 29) { call.reject("old android"); return; }
        try {
            int comma = data.indexOf(',');
            byte[] bytes = Base64.decode(comma >= 0 ? data.substring(comma + 1) : data, Base64.DEFAULT);
            ContentResolver cr = getContext().getContentResolver();
            Uri target = null;
            if (oldId >= 0) {
                Uri old = ContentUris.withAppendedId(IMAGES, oldId);
                try (java.io.OutputStream os = cr.openOutputStream(old, "wt")) {
                    if (os != null) { os.write(bytes); target = old; }
                } catch (Exception e) { target = null; }
            }
            if (target == null) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, name + ".png");
                v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                v.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/MX Studio");
                v.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri u = cr.insert(IMAGES, v);
                if (u == null) { call.reject("insert"); return; }
                try (java.io.OutputStream os = cr.openOutputStream(u)) {
                    os.write(bytes);
                }
                ContentValues fin = new ContentValues();
                fin.put(MediaStore.Images.Media.IS_PENDING, 0);
                cr.update(u, fin, null, null);
                target = u;
            }
            JSObject r = new JSObject();
            r.put("id", ContentUris.parseId(target));
            call.resolve(r);
        } catch (Throwable e) {
            call.reject("failed");
        }
    }

    // ---------- small thumbnail for the grid ----------
    @PluginMethod
    public void getThumb(PluginCall call) {
        send(call, 240, 78);
    }

    // ---------- bigger photo to open as a project ----------
    @PluginMethod
    public void getPhoto(PluginCall call) {
        send(call, 1080, 90);
    }

    private void send(PluginCall call, int defMax, int quality) {
        if (!granted()) {
            call.reject("denied");
            return;
        }
        long id = call.getData().optLong("id", -1);
        if (id < 0) {
            call.reject("bad id");
            return;
        }
        Integer m = call.getInt("max", defMax);
        int max = call.getInt("size", m);
        try {
            Uri u = ContentUris.withAppendedId(IMAGES, id);
            Bitmap b = decode(u, max);
            if (b == null) {
                call.reject("decode");
                return;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.JPEG, quality, out);
            JSObject r = new JSObject();
            r.put("img", "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            call.resolve(r);
        } catch (Throwable e) {
            call.reject("failed");
        }
    }

    private Bitmap decode(Uri u, int max) throws Exception {
        if (Build.VERSION.SDK_INT >= 28) {
            ImageDecoder.Source src = ImageDecoder.createSource(getContext().getContentResolver(), u);
            return ImageDecoder.decodeBitmap(src, (dec, info, s2) -> {
                Size sz = info.getSize();
                int big = Math.max(sz.getWidth(), sz.getHeight());
                if (big > max) {
                    float f = (float) max / big;
                    dec.setTargetSize(
                            Math.max(1, Math.round(sz.getWidth() * f)),
                            Math.max(1, Math.round(sz.getHeight() * f)));
                }
                dec.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
            });
        }
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
            BitmapFactory.decodeStream(in, null, o);
        }
        int sample = 1;
        while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= max) sample *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = sample;
        Bitmap b;
        try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
            b = BitmapFactory.decodeStream(in, null, o2);
        }
        if (b == null) return null;
        int rot = rotation(u);
        if (rot != 0) {
            Matrix mx = new Matrix();
            mx.postRotate(rot);
            b = Bitmap.createBitmap(b, 0, 0, b.getWidth(), b.getHeight(), mx, true);
        }
        return b;
    }

    private int rotation(Uri u) {
        try (Cursor c = getContext().getContentResolver().query(
                u, new String[]{MediaStore.Images.Media.ORIENTATION}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getInt(0);
        } catch (Exception e) { }
        return 0;
    }
}
