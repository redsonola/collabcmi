
#note: don't run this yet -- holding for safe keeping
tensorflowjs_converter --input_format=tf_frozen_model  \
--output_node_names="SemanticPredictions" --saved_model_tags=serve \
--strip_debug_ops=True --control_flow_v2=True\
--quantize_uint8 frozen_inference_graph.pb deeplabv3_mnv2_pascal_train_aug_web_model

# doesn't work
tensorflowjs_converter --input_format=tf_frozen_model --output_node_names="SemanticPredictions"\
 --saved_model_tags=serve --control_flow_v2=True --quantize_uint8 frozen_inference_graph.pb deeplabv3_mnv2_pascal_train_aug_web_model

# works
 tensorflowjs_converter --input_format=tf_frozen_model --output_node_names="SemanticPredictions"\
 --saved_model_tags=serve --control_flow_v2=True --quantization_bytes 1 frozen_inference_graph.pb deeplabv3_mnv2_pascal_train_aug_web_model

