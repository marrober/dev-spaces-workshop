# DevSpaces Workshop

To create the workshop assets run 'gulp'. This will generate a local instance of the web pages and it will also create a set of assets in the location dev-spaces-workshop/<version>. This is the location to point a httpd server at on OpenShift to serve the pages.

To update the version number edit the file documentation/antora.yml

## Run the workshop

To run the rendered workshop create a new deployment using the topology browser with the following characteristics :

    Git uri: 'https://github.com/marrober/dev-spaces-workshop.git'
    contextDir: /dev-spaces-workshop
    builder profile : httpd

## RHPDS instance 

To deliver the workshop spin instances of the 'Red Hat OpenShift Container Platform Cluster (AWS)'. Allocate one instance for each user.

## Workshop Environment Selection

To run the workshop chooser app for the users to get an environment use the application in workshop-app/. 

When the app is running go to the URL /admin for the admin console or /clusters for the users view to get a cluster.

