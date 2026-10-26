package io.github.flashsky1024.tavernium;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/** Home, cards and plugin operations share the browser's Cookie jar and saved Basic account. */
final class SessionClient {
    interface Cookies { String get(String url); void set(String url, String value) throws IOException; }
    interface BasicEncoder { String encode(byte[] value); }
    interface Events { void response(String method, String path, int status); }
    static final class Response {
        final int status;
        final String contentType;
        final byte[] body;
        Response(int status, String contentType, byte[] body) {
            this.status = status; this.contentType = contentType; this.body = body;
        }
        String text() { return new String(body, StandardCharsets.UTF_8); }
    }
    /** Ownership passes to the consumer; closing the image stream also releases its connection. */
    static final class StreamResponse implements java.io.Closeable {
        final int status;
        final String contentType;
        final InputStream body;
        StreamResponse(int status,String contentType,InputStream body){this.status=status;this.contentType=contentType;this.body=body;}
        @Override public void close()throws IOException{body.close();}
    }
    private final Cookies cookies;
    private final Events events;
    private final BasicEncoder basicEncoder;
    SessionClient(Cookies cookies, Events events, BasicEncoder basicEncoder) { this.cookies = cookies; this.events = events; this.basicEncoder = basicEncoder; }

    Response request(String base, String user, String password, String method, String path,
                     String json, String csrf) throws IOException {
        try(StreamResponse response=requestStream(base,user,password,method,path,json,csrf)){
            ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int count;
            while((count=response.body.read(buffer))!=-1)output.write(buffer,0,count);
            return new Response(response.status,response.contentType,output.toByteArray());
        }
    }

    StreamResponse requestStream(String base,String user,String password,String method,String path,
                                 String json,String csrf)throws IOException {
        URI origin = URI.create(base);
        URI target = origin.resolve(path);
        if (!target.getScheme().equalsIgnoreCase(origin.getScheme())
                || !target.getRawAuthority().equalsIgnoreCase(origin.getRawAuthority())) {
            throw new IOException("请求地址必须属于当前酒馆");
        }
        HttpURLConnection connection = (HttpURLConnection) target.toURL().openConnection();
        try {
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(25000);
            // A login redirect belongs to the browser; credentials stay on this origin.
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod(method);
            connection.setRequestProperty("Accept", "application/json, image/*;q=0.9");
            String cookie = cookies.get(target.toString());
            if (cookie != null && !cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
            if (user != null && !user.isEmpty()) {
                String account = user + ":" + (password == null ? "" : password);
                connection.setRequestProperty("Authorization", "Basic "
                        + basicEncoder.encode(account.getBytes(StandardCharsets.UTF_8)));
            }
            if (csrf != null && !csrf.isEmpty()) connection.setRequestProperty("X-CSRF-Token", csrf);
            if (json != null) {
                byte[] data = json.getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setFixedLengthStreamingMode(data.length);
                try (java.io.OutputStream out = connection.getOutputStream()) { out.write(data); }
            }
            int status = connection.getResponseCode();
            for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
                if (header.getKey() != null && header.getKey().equalsIgnoreCase("Set-Cookie")) {
                    for (String value : header.getValue()) cookies.set(target.toString(), value);
                }
            }
            events.response(method, target.getPath(), status);
            InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            InputStream stream=new java.io.FilterInputStream(input==null?new java.io.ByteArrayInputStream(new byte[0]):input){
                @Override public void close()throws IOException{try{super.close();}finally{connection.disconnect();}}
            };
            return new StreamResponse(status,connection.getContentType(),stream);
        } catch(IOException|RuntimeException error){connection.disconnect();throw error;}
    }
}
