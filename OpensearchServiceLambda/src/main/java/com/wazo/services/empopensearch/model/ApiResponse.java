package com.wazo.services.empopensearch.model;


import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.google.gson.Gson;
import lombok.Builder;
import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
@Builder
public class ApiResponse {
    private int status;
    private String message;
    private Object errors;
    private Object data;

    public APIGatewayProxyResponseEvent proxyResponse(){
        Map<String, String> responseHeader = new HashMap<>();
        responseHeader.put("Content-Type", "application/json");
        responseHeader.put("Access-Control-Allow-Origin", "*");

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("status", status);
        responseBody.put("message", message);
        if (data!=null){
            responseBody.put("data", data);
        }
        if (errors!=null){
            responseBody.put("errors", errors);
        }
        Gson gson = new Gson();
        String jsonResponseBody = gson.toJson(responseBody);
        return new APIGatewayProxyResponseEvent()
                .withStatusCode(status)
                .withHeaders(responseHeader)
                .withBody(jsonResponseBody);
    }
}
