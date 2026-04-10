cmake_minimum_required(VERSION 3.22.1)
project(miyo_runtime)

add_library(
    miyo_runtime
    SHARED
    native_runtime.cpp
)

find_library(
    log-lib
    log
)

target_link_libraries(
    miyo_runtime
    ${log-lib}
)

