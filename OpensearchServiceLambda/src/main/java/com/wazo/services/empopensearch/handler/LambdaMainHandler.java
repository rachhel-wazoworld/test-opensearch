package com.wazo.services.empopensearch.handler;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.wazo.services.empopensearch.model.ApiResponse;
import org.opensearch.client.opensearch.OpenSearchClient;
import org.opensearch.client.opensearch.core.InfoResponse;
import org.opensearch.client.transport.aws.AwsSdk2Transport;
import org.opensearch.client.transport.aws.AwsSdk2TransportOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.http.SdkHttpClient;
import software.amazon.awssdk.http.apache.ApacheHttpClient;
import software.amazon.awssdk.regions.Region;

public class LambdaMainHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
    private static final Logger log = LoggerFactory.getLogger(LambdaMainHandler.class);
    @Override
    public APIGatewayProxyResponseEvent handleRequest(APIGatewayProxyRequestEvent input, Context context) {
        String COLLECTION_HOST = System.getenv("COLLECTION_HOST");
        log.info("COLLECTION_HOST: {}", COLLECTION_HOST);
        try {
            SdkHttpClient httpClient = ApacheHttpClient.builder().build();
            OpenSearchClient client = new OpenSearchClient(
                    new AwsSdk2Transport(
                            httpClient,
                            COLLECTION_HOST,
                            "aoss",
                            Region.US_EAST_1,
                            AwsSdk2TransportOptions.builder().build()
                    )
            );
            InfoResponse info = client.info();
            log.info("Client Build success! {}: {}", info.version().distribution(), info.version().number());
            httpClient.close();
            return ApiResponse.builder().status(200).message("success").data("Client Build success!").build().proxyResponse();
        }catch (Exception e){
            log.error("Error: ", e);
            return ApiResponse.builder().status(200).message("error").data("Build failed! "+e.getMessage()).build().proxyResponse();
        }
    }
}