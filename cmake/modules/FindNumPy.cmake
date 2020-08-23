# Find the Python NumPy package
# PYTHON_NUMPY_INCLUDE_DIR
# PYTHON_NUMPY_FOUND
# will be set by this script

cmake_minimum_required(VERSION 2.6)

if(NOT Python_EXECUTABLE)
  find_package( PythonInterp ${PSP_PYTHON_VERSION} EXACT REQUIRED )
  set(__numpy_out 1)
endif()

if (Python_EXECUTABLE)
  # Find out the include path
  execute_process(
    COMMAND "${Python_EXECUTABLE}" -c
            "from __future__ import print_function;import numpy;print(numpy.get_include(), end='')"
            OUTPUT_VARIABLE __numpy_path)
  # And the version
  execute_process(
    COMMAND "${Python_EXECUTABLE}" -c
            "from __future__ import print_function;import numpy;print(numpy.__version__, end='')"
    OUTPUT_VARIABLE __numpy_version)
elseif(__numpy_out)
  message(STATUS "Python executable not found.")
endif(Python_EXECUTABLE)

find_path(PYTHON_NUMPY_INCLUDE_DIR numpy/arrayobject.h
  HINTS "${__numpy_path}" "${PYTHON_INCLUDE_PATH}" NO_DEFAULT_PATH)

if(PYTHON_NUMPY_INCLUDE_DIR)
  set(PYTHON_NUMPY_FOUND 1 CACHE INTERNAL "Python numpy found")
endif(PYTHON_NUMPY_INCLUDE_DIR)

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(NumPy REQUIRED_VARS PYTHON_NUMPY_INCLUDE_DIR
                                        VERSION_VAR __numpy_version)
