package com.rieman.mxstudio;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle b) {
        registerPlugin(PhotosPlugin.class);
        super.onCreate(b); getWindow().setStatusBarColor(android.graphics.Color.parseColor("#121212"));
    }
}
